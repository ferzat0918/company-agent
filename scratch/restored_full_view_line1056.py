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