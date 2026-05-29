#!/usr/bin/env python3
"""CLI to manage WeChat RPA as a headless background service.

Usage:
    python rpa_cli.py start    Start RPA in background (no console window)
    python rpa_cli.py stop     Stop the running RPA process
    python rpa_cli.py status   Check if RPA is running
    python rpa_cli.py logs     Tail the RPA log file (Ctrl+C to stop)
    python rpa_cli.py restart  Stop + Start
"""
import os
import sys
import subprocess
import time

# Force UTF-8 output on Windows (cmd.exe defaults to GBK which chokes on emoji)
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PID_FILE = os.path.join(SCRIPT_DIR, "logs", "rpa.pid")
LOG_FILE = os.path.join(SCRIPT_DIR, "logs", "rpa_client.log")
RPA_SCRIPT = os.path.join(SCRIPT_DIR, "wechat_rpa_v4.py")


def _read_pid() -> int | None:
    """Read PID from file, return None if missing or stale."""
    try:
        with open(PID_FILE, "r") as f:
            pid = int(f.read().strip())
        if _is_running(pid):
            return pid
    except (FileNotFoundError, ValueError):
        pass
    return None


def _is_running(pid: int) -> bool:
    """Check if a process with given PID is alive (Windows)."""
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
            capture_output=True, text=True, timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        return f'"{pid}"' in result.stdout
    except Exception:
        return False


def start():
    """Launch RPA as a headless background process."""
    existing = _read_pid()
    if existing:
        print(f"⚠️  RPA 已经在运行中 (PID: {existing})。先执行 stop 再 start，或用 restart。")
        return

    os.makedirs(os.path.join(SCRIPT_DIR, "logs"), exist_ok=True)

    # Launch with CREATE_NO_WINDOW — no console, no QuickEdit, no freeze
    proc = subprocess.Popen(
        [sys.executable, RPA_SCRIPT],
        cwd=SCRIPT_DIR,
        creationflags=subprocess.CREATE_NO_WINDOW,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Write PID file
    with open(PID_FILE, "w") as f:
        f.write(str(proc.pid))

    print(f"🚀 RPA 已在后台启动！PID: {proc.pid}")
    print(f"   日志文件: {LOG_FILE}")
    print(f"   查看状态: python rpa_cli.py status")
    print(f"   查看日志: python rpa_cli.py logs")
    print(f"   停止服务: python rpa_cli.py stop")


def stop():
    """Stop the running RPA process."""
    pid = _read_pid()
    if not pid:
        print("ℹ️  RPA 未在运行。")
        _cleanup_pid()
        return

    print(f"⏳ 正在停止 RPA (PID: {pid})...")
    try:
        # taskkill /T kills child processes too
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            capture_output=True, timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except Exception as e:
        print(f"⚠️  停止时出现异常: {e}")

    _cleanup_pid()

    # Verify
    time.sleep(1)
    if _is_running(pid):
        print(f"❌ 进程 {pid} 仍在运行，请手动执行: taskkill /F /PID {pid}")
    else:
        print("✅ RPA 已停止。")


def status():
    """Check if RPA is running."""
    pid = _read_pid()
    if pid:
        print(f"🟢 RPA 正在运行 (PID: {pid})")
        # Show last few log lines
        _show_last_logs(5)
    else:
        print("🔴 RPA 未在运行。")
        _cleanup_pid()


def logs():
    """Tail the log file in real-time."""
    if not os.path.exists(LOG_FILE):
        print(f"⚠️  日志文件不存在: {LOG_FILE}")
        return

    print(f"📋 正在监听日志 (Ctrl+C 退出): {LOG_FILE}")
    print("=" * 60)

    # Show last 20 lines first
    _show_last_logs(20)

    # Then tail
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            f.seek(0, 2)  # Go to end
            while True:
                line = f.readline()
                if line:
                    print(line, end="")
                else:
                    time.sleep(0.3)
    except KeyboardInterrupt:
        print("\n👋 已停止监听日志。")


def restart():
    """Stop then start."""
    stop()
    time.sleep(2)
    start()


def _show_last_logs(n: int):
    """Print the last N lines of the log file."""
    if not os.path.exists(LOG_FILE):
        return
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
        for line in lines[-n:]:
            print(f"  {line}", end="")
        if lines:
            print()
    except Exception:
        pass


def _cleanup_pid():
    """Remove stale PID file."""
    try:
        os.remove(PID_FILE)
    except FileNotFoundError:
        pass


COMMANDS = {
    "start": start,
    "stop": stop,
    "status": status,
    "logs": logs,
    "restart": restart,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        print("可用命令:", ", ".join(COMMANDS.keys()))
        sys.exit(1)

    COMMANDS[sys.argv[1]]()
