#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UMX 每日自动部署脚本 — 凌晨 4 点由 Windows 计划任务触发

流程：
  1. git fetch origin main
  2. 比较本地 HEAD 与 origin/main
  3. 如有新 commit → git pull → 智能部署 → 重启 RPA（如需要）
  4. 如无变化 → 静默退出
  5. 失败只记日志，不做其他处理
"""

import os
import sys
import subprocess
import time
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

# ── 路径配置 ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
INFRA_DIR = os.path.join(REPO_ROOT, "infra")
RPA_CLI = os.path.join(REPO_ROOT, "scripts", "rpa", "rpa_cli.py")
DEPLOY_SCRIPT = os.path.join(SCRIPT_DIR, "deploy.py")
LOG_DIR = os.path.join(REPO_ROOT, "logs")
LOG_FILE = os.path.join(LOG_DIR, "auto_deploy.log")

BRANCH = "main"

# ── 日志 ──
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("auto_deploy")
logger.setLevel(logging.INFO)

formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

file_handler = RotatingFileHandler(
    LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)


def run(cmd, cwd=None, timeout=600):
    """运行命令并返回 (success, stdout, stderr)"""
    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        result = subprocess.run(
            cmd, shell=True, cwd=cwd or REPO_ROOT,
            capture_output=True, text=True, timeout=timeout, env=env
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "命令执行超时"
    except Exception as e:
        return False, "", str(e)


def get_local_head():
    """获取本地当前 commit hash"""
    ok, out, _ = run(f"git rev-parse HEAD")
    return out if ok else None


def get_remote_head():
    """获取远程分支最新 commit hash"""
    ok, out, _ = run(f"git rev-parse origin/{BRANCH}")
    return out if ok else None


def get_changed_files(old_hash, new_hash):
    """获取两个 commit 之间变更的文件列表"""
    ok, out, _ = run(f"git diff --name-only {old_hash} {new_hash}")
    if ok and out:
        return out.split("\n")
    return []


def needs_full_rebuild(changed_files):
    """判断是否需要完整 rebuild（前端/Dockerfile/compose/依赖变更）"""
    full_rebuild_patterns = [
        "frontend/",
        "infra/Dockerfile",
        "infra/docker-compose",
        "backend/pyproject.toml",
        "backend/setup.py",
        "langgraph.json",
    ]
    for f in changed_files:
        for pattern in full_rebuild_patterns:
            if f.startswith(pattern) or f == pattern:
                return True
    return False


def needs_rpa_restart(changed_files):
    """判断是否需要重启 RPA"""
    for f in changed_files:
        if f.startswith("scripts/rpa/"):
            return True
    return False


def needs_container_restart(changed_files):
    """判断是否需要重启 langgraph 容器（prompt/skills/backend 代码变更）
    
    这些目录是 bind-mount 的，文件 git pull 后容器内自动可见，
    但 Python 进程需要重启才能加载新代码。
    """
    restart_patterns = [
        "prompts/",
        "skills/",
        "backend/src/",
        "backend/tests/",
    ]
    for f in changed_files:
        for pattern in restart_patterns:
            if f.startswith(pattern):
                return True
    return False


def get_docker_compose_cmd():
    """检测 docker compose 命令格式"""
    ok, _, _ = run("docker compose version")
    if ok:
        return "docker compose"
    ok, _, _ = run("docker-compose version")
    if ok:
        return "docker-compose"
    return "docker compose"


def do_lightweight_restart():
    """轻量级重启：只重启 langgraph 容器（约 5 秒）"""
    compose_cmd = get_docker_compose_cmd()
    logger.info("⚡ 执行轻量级重启（仅重启 langgraph 容器）...")
    ok, out, err = run(
        f"{compose_cmd} --env-file ../.env restart langgraph",
        cwd=INFRA_DIR, timeout=120
    )
    if ok:
        logger.info("✅ langgraph 容器重启成功")
    else:
        logger.error(f"❌ langgraph 容器重启失败: {err}")
    return ok


def do_full_deploy():
    """完整部署：调用 deploy.py（前端 build + docker rebuild + pytest）"""
    logger.info("🔨 执行完整部署（前端编译 + 容器重建）...")
    ok, out, err = run(
        f'python "{DEPLOY_SCRIPT}"',
        cwd=REPO_ROOT, timeout=900  # 15 分钟超时
    )
    if ok:
        logger.info("✅ 完整部署成功")
    else:
        logger.error(f"❌ 完整部署失败: {err[-500:] if err else '无错误输出'}")
    return ok


def do_rpa_restart():
    """重启 WeChat RPA 服务"""
    logger.info("🤖 正在重启 WeChat RPA 服务...")
    ok, out, err = run(
        f'python "{RPA_CLI}" restart',
        cwd=os.path.dirname(RPA_CLI), timeout=30
    )
    if ok:
        logger.info("✅ RPA 重启成功")
    else:
        logger.error(f"❌ RPA 重启失败: {err}")
    return ok


def main():
    logger.info("=" * 60)
    logger.info("🕐 每日自动部署检查开始")
    logger.info(f"   仓库路径: {REPO_ROOT}")
    logger.info(f"   跟踪分支: {BRANCH}")
    logger.info("=" * 60)

    # 1. 记录当前 commit
    local_before = get_local_head()
    if not local_before:
        logger.error("❌ 无法获取本地 HEAD，仓库可能未初始化")
        return

    logger.info(f"📌 当前本地 HEAD: {local_before[:8]}")

    # 2. Fetch 远程
    logger.info(f"📡 正在 fetch origin/{BRANCH}...")
    ok, _, err = run(f"git fetch origin {BRANCH}", timeout=120)
    if not ok:
        logger.error(f"❌ git fetch 失败: {err}")
        return

    # 3. 比较
    remote_head = get_remote_head()
    if not remote_head:
        logger.error("❌ 无法获取远程 HEAD")
        return

    logger.info(f"📌 远程 HEAD: {remote_head[:8]}")

    if local_before == remote_head:
        logger.info("✅ 本地已是最新，无需部署。退出。")
        return

    # 4. 有变更，先看看改了什么
    changed_files = get_changed_files(local_before, remote_head)
    logger.info(f"📝 检测到 {len(changed_files)} 个文件变更:")
    for f in changed_files[:20]:
        logger.info(f"   - {f}")
    if len(changed_files) > 20:
        logger.info(f"   ... 还有 {len(changed_files) - 20} 个文件")

    # 5. Git pull
    logger.info("⬇️ 正在 git pull...")
    ok, _, err = run(f"git pull origin {BRANCH}", timeout=120)
    if not ok:
        logger.error(f"❌ git pull 失败: {err}")
        return

    local_after = get_local_head()
    logger.info(f"📌 更新后 HEAD: {local_after[:8]}")

    # 6. 智能部署
    full_rebuild = needs_full_rebuild(changed_files)
    container_restart = needs_container_restart(changed_files)
    rpa_restart = needs_rpa_restart(changed_files)

    logger.info(f"🧠 部署策略分析:")
    logger.info(f"   完整重建: {'是' if full_rebuild else '否'}")
    logger.info(f"   容器重启: {'是' if container_restart else '否'}")
    logger.info(f"   RPA 重启: {'是' if rpa_restart else '否'}")

    deploy_ok = True

    if full_rebuild:
        deploy_ok = do_full_deploy()
    elif container_restart:
        deploy_ok = do_lightweight_restart()
    else:
        logger.info("ℹ️ 变更文件不涉及后端/前端/容器，跳过部署步骤。")

    if rpa_restart:
        do_rpa_restart()

    # 7. 总结
    if deploy_ok:
        logger.info(f"🎉 自动部署完成！{local_before[:8]} → {local_after[:8]}")
    else:
        logger.error(f"⚠️ 部署过程中有步骤失败，请检查日志: {LOG_FILE}")

    logger.info("=" * 60)


if __name__ == "__main__":
    main()
