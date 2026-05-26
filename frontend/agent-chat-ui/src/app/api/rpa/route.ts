import { NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { supabase } from "@/lib/supabase";

const execAsync = promisify(exec);
const REPO_ROOT = "C:\\Users\\lenovo\\company-agent";

async function getRpaPids(): Promise<number[]> {
  try {
    // PowerShell CIM Win32_Process is highly robust on Windows to find active processes by command line string
    const psCmd = `powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*wechat_rpa_v4.py*' -and $_.CommandLine -notlike '*powershell*' } | Select-Object -ExpandProperty ProcessId"`;
    const { stdout } = await execAsync(psCmd);
    const pids = stdout.split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line && !isNaN(Number(line)))
      .map(Number);
    return pids;
  } catch (err) {
    try {
      // WMIC fallback
      const wmicCmd = `wmic process where "CommandLine like '%wechat_rpa_v4.py%' and not CommandLine like '%wmic%'" get ProcessId`;
      const { stdout } = await execAsync(wmicCmd);
      const pids = stdout.split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => line && !isNaN(Number(line)))
        .map(Number);
      return pids;
    } catch (e) {
      return [];
    }
  }
}

export async function GET() {
  try {
    const pids = await getRpaPids();
    const isRunning = pids.length > 0;
    return NextResponse.json({ isRunning, pids });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    if (action === "start") {
      const pids = await getRpaPids();
      if (pids.length > 0) {
        return NextResponse.json({ success: true, message: "RPA is already running", pids });
      }
      
      // Ensure logs directory exists
      const logsDir = path.join(REPO_ROOT, "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const logPath = path.join(logsDir, "rpa_client.log");
      const logStream = fs.openSync(logPath, "a");
      
      // Spawn local Python daemon
      const child = spawn("python", ["wechat_rpa_v4.py"], {
        cwd: REPO_ROOT,
        detached: true,
        stdio: ["ignore", logStream, logStream]
      });
      
      child.unref();
      
      // Wait a tiny moment to verify startup
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newPids = await getRpaPids();
      
      return NextResponse.json({ 
        success: newPids.length > 0, 
        message: newPids.length > 0 ? "微信 RPA 启动成功！" : "RPA 验证启动超时",
        pids: newPids 
      });
      
    } else if (action === "stop") {
      const pids = await getRpaPids();
      if (pids.length === 0) {
        return NextResponse.json({ success: true, message: "RPA is already stopped" });
      }
      
      // Kill all running PIDs
      for (const pid of pids) {
        try {
          await execAsync(`taskkill /F /PID ${pid}`);
        } catch (e) {
          try {
            await execAsync(`powershell -Command "Stop-Process -Id ${pid} -Force"`);
          } catch (err) {
            console.error(`Failed to kill PID ${pid}:`, err);
          }
        }
      }
      
      // Update public.wechat_status to offline in Supabase instantly
      try {
        await supabase.from("wechat_status").update({
          client_status: "offline",
          updated_at: new Date().toISOString()
        }).eq("id", "default");
      } catch (dbErr) {
        console.error("Failed to update status in Supabase:", dbErr);
      }
      
      return NextResponse.json({ success: true, message: "微信 RPA 进程已停止！" });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
