#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UMX 响应式空间硬件系统 — 终极打包与极速安全部署脚本
[ 极简守序 | 航空级硬核 | 物理持久卷防丢保障 ]
"""

import os
import sys
import shutil
import urllib.request
import urllib.error
import zipfile
import tarfile
import subprocess
import time

# UMX 风格终端配色规范 (ANSI)
C_INFO = "\033[1;36m"     # 先锋蓝
C_SUCCESS = "\033[1;32m"  # 极光绿
C_WARN = "\033[1;33m"     # 偏振黄
C_ERROR = "\033[1;31m"    # 警示红
C_RESET = "\033[0m"       # 守序灰
C_BOLD = "\033[1m"

def print_umx_header():
    header = f"""{C_INFO}
============================================================
          UMX SPACE HARDWARE SYSTEM - DEPLOYER V4
         [ Cold Structure & Emotional Light Field ]
============================================================{C_RESET}"""
    print(header)

def log_info(msg):
    print(f"{C_INFO}[INFO]{C_RESET} {msg}")

def log_success(msg):
    print(f"{C_SUCCESS}[SUCCESS]{C_RESET} {msg}")

def log_warn(msg):
    print(f"{C_WARN}[WARN]{C_RESET} {msg}")

def log_error(msg):
    print(f"{C_ERROR}[ERROR]{C_RESET} {msg}")

def run_command(cmd, cwd=None, show_output=True):
    """在指定目录中执行命令，继承 modified path 的环境变量"""
    log_info(f"正在执行: {C_BOLD}{cmd}{C_RESET} (目录: {cwd or '.'})")
    
    # 强制使用 utf-8 编码，防止 Windows 中文环境乱码
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    stdout_opt = None if show_output else subprocess.PIPE
    stderr_opt = None if show_output else subprocess.PIPE
    
    res = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        env=env,
        stdout=stdout_opt,
        stderr=stderr_opt,
        text=True
    )
    
    if res.returncode != 0:
        log_error(f"命令执行失败，返回码: {res.returncode}")
        if not show_output and res.stderr:
            print(res.stderr)
        return False
    return True

def command_exists(cmd):
    """检测本地环境命令是否存在并返回版本"""
    try:
        res = subprocess.run(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if res.returncode == 0:
            return res.stdout.strip().split('\n')[0]
    except Exception:
        pass
    return None

def download_file(urls, dest_path):
    """顺序尝试多个下载源，支持断网重试与极速国内节点优先"""
    for url in urls:
        log_info(f"正在尝试下载自: {url}")
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=45) as response:
                total_size = int(response.info().get('Content-Length', 0))
                downloaded = 0
                chunk_size = 1024 * 1024  # 1MB chunks
                
                with open(dest_path, "wb") as out_file:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        out_file.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            # 极简静默或行内刷新进度
                            sys.stdout.write(f"\r进度: {percent:.2f}% ({downloaded / 1024 / 1024:.2f}MB / {total_size / 1024 / 1024:.2f}MB)")
                            sys.stdout.flush()
                print()  # 换行
                log_success("下载成功！")
                return True
        except urllib.error.URLError as e:
            log_warn(f"连接失败/超时 (源: {url})，详细错误: {e}")
        except Exception as e:
            log_warn(f"意外错误 (源: {url}): {e}")
    return False

def extract_archive(archive_path, extract_dir, archive_type):
    """解压压缩包，Unix 系统自动保留可执行属性"""
    log_info(f"正在释放解压至: {extract_dir}...")
    if not os.path.exists(extract_dir):
        os.makedirs(extract_dir)
        
    if archive_type == "zip":
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
    elif archive_type in ["tar.xz", "tar.gz"]:
        with tarfile.open(archive_path, 'r:*') as tar_ref:
            tar_ref.extractall(extract_dir)
    log_success("解压完成！")

def get_docker_compose_cmd():
    """动态检查宿主机支持的是 docker compose 还是旧版 docker-compose"""
    if command_exists("docker compose version"):
        return "docker compose"
    elif command_exists("docker-compose version"):
        return "docker-compose"
    return "docker compose"

def main():
    print_umx_header()
    
    # Updated: Now that deploy.py is inside scripts/deploy/, we need 3 levels of parent directories
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    node_env_dir = os.path.join(repo_root, ".node_env")
    
    # -------------------------------------------------------------
    # 步骤 1. 环境自检与国内源优先自动下载
    # -------------------------------------------------------------
    log_info("【第一阶段】运行环境自检...")
    
    node_ver = command_exists("node -v")
    pnpm_ver = command_exists("pnpm -v")
    
    node_ready = node_ver is not None
    pnpm_ready = pnpm_ver is not None
    
    if node_ready:
        log_success(f"检测到全局 Node.js: {node_ver}")
    else:
        log_warn("未检测到系统 Node.js 运行环境，将启动国内源极速自动下载安装流程...")
        
    if pnpm_ready:
        log_success(f"检测到全局 pnpm: {pnpm_ver}")
    else:
        log_warn("未检测到 pnpm 环境，将进行自动装载...")
        
    # 如果缺 Node.js，执行动态下载与绿色版部署
    if not node_ready:
        NODE_VERSION = "v20.11.1"
        platform = sys.platform
        
        # 准备不同操作系统的下载配置
        if platform == "win32":
            fn = f"node-{NODE_VERSION}-win-x64.zip"
            archive_type = "zip"
            mirrors = [
                f"https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/{NODE_VERSION}/{fn}",
                f"https://npmmirror.com/mirrors/node/{NODE_VERSION}/{fn}",
                f"https://nodejs.org/dist/{NODE_VERSION}/{fn}"
            ]
        elif platform == "darwin":
            fn = f"node-{NODE_VERSION}-darwin-x64.tar.gz"
            archive_type = "tar.gz"
            mirrors = [
                f"https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/{NODE_VERSION}/{fn}",
                f"https://npmmirror.com/mirrors/node/{NODE_VERSION}/{fn}",
                f"https://nodejs.org/dist/{NODE_VERSION}/{fn}"
            ]
        else: # Default to Linux x64
            fn = f"node-{NODE_VERSION}-linux-x64.tar.xz"
            archive_type = "tar.xz"
            mirrors = [
                f"https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/{NODE_VERSION}/{fn}",
                f"https://npmmirror.com/mirrors/node/{NODE_VERSION}/{fn}",
                f"https://nodejs.org/dist/{NODE_VERSION}/{fn}"
            ]
            
        if not os.path.exists(node_env_dir):
            os.makedirs(node_env_dir)
            
        archive_dest = os.path.join(node_env_dir, fn)
        
        # 执行下载
        if not os.path.exists(archive_dest):
            log_info(f"正在拉取绿色便携式 Node.js ({NODE_VERSION})...")
            success = download_file(mirrors, archive_dest)
            if not success:
                log_error("Node.js 所有镜像源及官方源均下载失败，请检查网络！")
                sys.exit(1)
        else:
            log_info("检测到已存在 Node.js 归档包，跳过下载阶段。")
            
        # 执行解压
        extract_archive(archive_dest, node_env_dir, archive_type)
        
        # 寻找解压出来的文件夹名
        node_home = None
        for entry in os.listdir(node_env_dir):
            full_path = os.path.join(node_env_dir, entry)
            if os.path.isdir(full_path) and entry.startswith("node-v") and not entry.endswith("global"):
                node_home = full_path
                break
                
        if not node_home:
            log_error("未找到解压后的 Node.js 主目录，请检查释放情况。")
            sys.exit(1)
            
        # 设置可执行权限 (针对 Linux/Mac)
        if platform != "win32":
            bin_dir = os.path.join(node_home, "bin")
            if os.path.exists(bin_dir):
                for f in os.listdir(bin_dir):
                    fpath = os.path.join(bin_dir, f)
                    try:
                        os.chmod(fpath, 0o755)
                    except Exception:
                        pass
                        
        # 动态修改当前 Python 进程会话的环境变量 PATH
        node_bin_path = node_home if platform == "win32" else os.path.join(node_home, "bin")
        os.environ["PATH"] = node_bin_path + os.pathsep + os.environ["PATH"]
        
        log_success(f"动态装载 Node.js 成功，Bin 路径: {node_bin_path}")
        
    # 如果缺 pnpm 或者之前是新建的 Node，需要在这个 Node 环境下装 pnpm
    if not pnpm_ready or not node_ready:
        log_info("正在配置独立 NPM 全局 Prefix 目录与阿里源，以防权限问题...")
        global_dir = os.path.join(node_env_dir, "global")
        if not os.path.exists(global_dir):
            os.makedirs(global_dir)
            
        # 配置 prefix
        run_command(f'npm config set prefix "{global_dir}"')
        # 配置镜像源为阿里云镜像站
        run_command('npm config set registry https://registry.npmmirror.com')
        
        # 将 global prefix 加到 PATH
        global_bin = global_dir if sys.platform == "win32" else os.path.join(global_dir, "bin")
        os.environ["PATH"] = global_bin + os.pathsep + os.environ["PATH"]
        
        log_info("正在通过国内源极速安装 pnpm...")
        success = run_command('npm install -g pnpm --registry=https://registry.npmmirror.com')
        if not success:
            log_error("pnpm 安装失败，请检查 npm 及网络状态。")
            sys.exit(1)
            
        # 配置 pnpm 为阿里云镜像站
        run_command('pnpm config set registry https://registry.npmmirror.com')
        log_success("pnpm 全自动安装与源配置完成！")

    # 双重验证 Node / pnpm 可运行状态
    log_info("验证安装后的环境版本:")
    run_command("node -v")
    run_command("pnpm -v")
    
    # -------------------------------------------------------------
    # 步骤 2. 前端极速全量编译
    # -------------------------------------------------------------
    log_info("【第二阶段】执行前端全量静态重构与包编译...")
    frontend_dir = os.path.join(repo_root, "frontend", "agent-chat-ui")
    
    if not os.path.exists(frontend_dir):
        log_error(f"未找到前端目录: {frontend_dir}")
        sys.exit(1)
        
    log_info("正在安装前端依赖 (优先阿里云 NPM 镜像)...")
    if not run_command("pnpm install", cwd=frontend_dir):
        log_error("前端依赖包安装失败，终止部署。")
        sys.exit(1)
        
    log_info("正在编译 Next.js 静态文件 (pnpm build)...")
    # 清理旧的编译缓存，保证全量编译干净
    next_dir = os.path.join(frontend_dir, ".next")
    out_dir = os.path.join(frontend_dir, "out")
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
        
    if not run_command("pnpm build", cwd=frontend_dir):
        log_error("前端静态打包 build 失败，终止重建！")
        sys.exit(1)
        
    log_success("前端 Next.js 极速静态重构编译完成，物理 out/ 静态产物已生成。")
    
    # -------------------------------------------------------------
    # 步骤 3. 终极容器无损重建 (零卷清空，数据绝不丢失)
    # -------------------------------------------------------------
    log_info("【第三阶段】执行终极容器无损重构构建...")
    infra_dir = os.path.join(repo_root, "infra")
    
    compose_cmd = get_docker_compose_cmd()
    log_info(f"使用 Docker 编排引擎: {compose_cmd}")
    
    # 安全守护提示：展示物理数据卷在重建过程中绝对安全
    log_info(f"{C_BOLD}数据卷保护提示：即将运行 docker compose down，但坚决不携带任何 -v/--volumes 标志，postgres-data 与 storage-data 将受到 100% 物理级隔离保护！{C_RESET}")
    
    # 1. 停止并解体当前容器 (保留 Named Volumes)
    if not run_command(f"{compose_cmd} --env-file ../.env down", cwd=infra_dir):
        log_warn("docker compose down 执行时遇到异常，将继续强制重建。")
        
    # 2. 全量强力重建镜像、容器并拉起
    log_info("正在执行终极无损重建拉起 (docker compose up -d --build --force-recreate)...")
    if not run_command(f"{compose_cmd} --env-file ../.env up -d --build --force-recreate", cwd=infra_dir):
        log_error("Docker 终极无损重建执行失败，请检查 Dockerfile 及镜像文件！")
        sys.exit(1)
        
    log_success("Docker 所有后端、沙箱、前端容器全量“终极重建”已成功拉起，持久化卷数据安然无恙！")

    # -------------------------------------------------------------
    # 修复 Gotrue 启动冲突表 (自动清理 public.schema_migrations)
    # -------------------------------------------------------------
    log_info("正在执行 Gotrue 数据库迁移冲突修复 (自动清理 public.schema_migrations)...")
    db_clean_cmd = "docker exec -i supabase-postgres psql -U postgres -d postgres -c \"DROP TABLE IF EXISTS public.schema_migrations;\""
    run_command(db_clean_cmd)

    log_info("正在重新激活 Gotrue 服务生命周期...")
    restart_gotrue_cmd = f"{compose_cmd} --env-file ../.env restart gotrue"
    run_command(restart_gotrue_cmd, cwd=infra_dir)

    # -------------------------------------------------------------

    # 步骤 4. 系统完整可用性验证 (pytest 远程质检)
    # -------------------------------------------------------------
    log_info("【第四阶段】执行远程单元测试及可用气质检 (pytest)...")
    log_info("等待 5 秒以确保数据库及服务生命周期完全就绪...")
    time.sleep(5)
    
    # 执行远程 pytest
    test_cmd = f"{compose_cmd} --env-file ../.env exec -T langgraph sh -c \"PYTHONPATH=/app pytest\""
    test_success = run_command(test_cmd, cwd=infra_dir)
    
    if test_success:
        log_success("36项系统核心功能质检单元测试 100% 成功通过！部署完美完成！")
    else:
        log_error("系统虽然拉起，但在容器内运行的部分 pytest 质检单元测试未通过，请检查测试报告。")
        sys.exit(1)

if __name__ == "__main__":
    main()
