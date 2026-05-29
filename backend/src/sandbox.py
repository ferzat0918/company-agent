import os
import time
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

# Load environment variables (e.g. Daytona credentials)
load_dotenv()

try:
    from daytona_sdk import Daytona, CreateSandboxFromImageParams, Image
except ImportError:
    from daytona import Daytona, CreateSandboxFromImageParams, Image

WORKSPACE_DIR_NAME = "workspace"

class SandboxExecutionInput(BaseModel):
    code: str = Field(
        description=(
            "要在隔离 Daytona 沙盒中运行的完整 Python 3.11 代码。 "
            "工作目录为 `./`（已预装 pandas, openpyxl, python-docx, pdfplumber, matplotlib 等库）。 "
            "所有输出结果必须通过 print() 打印出来，所有编辑或生成的文件请直接保存在当前目录下。"
        )
    )

def _clean_old_files(workspace_parent_dir: str, max_days: int = 30) -> None:
    """自动清理 workspace 目录中修改时间超过指定天数的文件和过期的 thread_id 文件夹，防止硬盘占满"""
    try:
        now = time.time()
        cutoff = now - (max_days * 86400)
        if not os.path.exists(workspace_parent_dir):
            return
            
        import shutil
        for item in os.listdir(workspace_parent_dir):
            item_path = os.path.join(workspace_parent_dir, item)
            # 排除隐藏文件
            if item.startswith("."):
                continue
                
            if os.path.isfile(item_path):
                # 根目录下的残留文件，按时间清理
                try:
                    mtime = os.path.getmtime(item_path)
                    if mtime < cutoff:
                        os.remove(item_path)
                        print(f"[Cleanup] Removed expired root file: {item} (older than {max_days} days)")
                except Exception as file_err:
                    print(f"[Cleanup] Failed to remove root file {item}: {str(file_err)}")
            elif os.path.isdir(item_path):
                # thread_id 隔离文件夹
                try:
                    # 获取该文件夹内所有文件
                    all_files = []
                    for root_dir, dirs, files in os.walk(item_path):
                        for f in files:
                            all_files.append(os.path.join(root_dir, f))
                            
                    if not all_files:
                        # 空目录，直接以目录修改时间判定是否超时
                        dir_mtime = os.path.getmtime(item_path)
                        if dir_mtime < cutoff:
                            shutil.rmtree(item_path)
                            print(f"[Cleanup] Removed expired empty directory: {item}")
                    else:
                        # 检查目录下所有文件是否都已超时
                        all_expired = True
                        for f_path in all_files:
                            try:
                                if os.path.getmtime(f_path) >= cutoff:
                                    all_expired = False
                                    break
                            except Exception:
                                pass
                        
                        if all_expired:
                            shutil.rmtree(item_path)
                            print(f"[Cleanup] Removed expired directory and all its files: {item}")
                except Exception as dir_err:
                    print(f"[Cleanup] Failed to process directory {item}: {str(dir_err)}")
    except Exception as err:
        print(f"[Cleanup] Error scanning workspace: {str(err)}")

def _download_dir_recursive(sandbox, remote_dir: str, local_dir: str):
    """递归下载沙盒目录下的所有文件和子目录，完美保留目录结构"""
    import os
    os.makedirs(local_dir, exist_ok=True)
    try:
        remote_items = sandbox.fs.list_files(remote_dir)
        for item in remote_items:
            name = item.name
            if name.startswith("."):
                continue
            
            # Form clean remote and local paths
            if remote_dir == "./" or remote_dir == "." or not remote_dir:
                remote_path = f"./{name}"
            else:
                remote_path = f"{remote_dir}/{name}"
                
            local_path = os.path.join(local_dir, name)
            
            if item.is_dir:
                _download_dir_recursive(sandbox, remote_path, local_path)
            else:
                try:
                    sandbox.fs.download_file(remote_path, local_path)
                except Exception as dl_err:
                    print(f"[Daytona] Failed to download file {remote_path}: {str(dl_err)}")
    except Exception as fs_err:
        print(f"[Daytona] Failed to list remote dir {remote_dir}: {str(fs_err)}")

def execute_python_in_sandbox(code: str, config: RunnableConfig = None) -> str:
    """在隔离的 Daytona Cloud 沙盒环境中执行 Python 代码。"""
    try:
        # 获取宿主机上的项目 workspace 绝对路径
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        workspace_parent = os.path.join(project_root, WORKSPACE_DIR_NAME)
        
        # 提取 thread_id 并做多线程隔离
        thread_id = "default"
        if config and isinstance(config, dict):
            thread_id = config.get("configurable", {}).get("thread_id", "default")
            
        workspace_dir = os.path.join(workspace_parent, thread_id)
        
        # 确保本地隔离子目录存在
        os.makedirs(workspace_dir, exist_ok=True)

        # 自动扫描并清理 30 天之前的历史旧文件
        _clean_old_files(workspace_parent, max_days=30)

        # 1. 初始化 Daytona 客户端
        # 会自动从环境变量中读取 DAYTONA_API_KEY 和 DAYTONA_API_URL
        daytona = Daytona()

        # 2. 定义预制镜像以避免每次运行临时下载库并对齐 /workspace 工作目录
        # 预装 ffmpeg, librsvg2-bin, poppler-utils 等格式转换与文档提取系统工具，以及 Pillow, cairosvg, moviepy 等 Python 库
        custom_image = (
            Image.debian_slim("3.11")
            .run_commands(
                "apt-get update",
                "apt-get install -y --no-install-recommends ffmpeg librsvg2-bin poppler-utils libcairo2-dev build-essential pkg-config libffi-dev",
                "rm -rf /var/lib/apt/lists/*"
            )
            .pip_install([
                "pandas", "openpyxl", "python-docx", "pdfplumber", "matplotlib",
                "cairosvg", "Pillow", "svglib", "pdf2image", "python-pptx", "requests", "jinja2", "pypdf", "moviepy"
            ])
            .workdir("/workspace")
        )

        # 3. 动态创建挂载了预装工具库的安全 Python 沙盒
        # 使用 ephemeral 沙盒，运行完在 finally 中自动销毁，确保无文件堆积和安全隔离
        sandbox = daytona.create(
            CreateSandboxFromImageParams(image=custom_image)
        )

        # 准备在宿主机打包技能目录并同步到沙盒，遵循 Hermes-Agent 架构的最佳实践
        local_tar_path = None
        try:
            import tempfile
            import tarfile
            skills_dir = os.path.join(project_root, "skills")
            if os.path.exists(skills_dir):
                temp_dir = tempfile.gettempdir()
                local_tar_path = os.path.join(temp_dir, f"skills_{thread_id}.tar.gz")
                
                # 宿主机极速压缩打包整个 skills/ 目录 (归档名设为 "skills" 使得解压到根目录后路径对齐为 /skills)
                with tarfile.open(local_tar_path, "w:gz") as tar:
                    tar.add(skills_dir, arcname="skills")
                
                # 上传压缩包至沙盒根目录
                sandbox.fs.upload_file(local_tar_path, "/skills.tar.gz")
                
                # 沙盒内静默解压至根目录以匹配 /skills 绝对路径，并清理沙盒内的临时压缩包
                init_skills_code = (
                    "import os, tarfile\n"
                    "if os.path.exists('/skills.tar.gz'):\n"
                    "    with tarfile.open('/skills.tar.gz', 'r:gz') as tar:\n"
                    "        tar.extractall(path='/')\n"
                    "    os.remove('/skills.tar.gz')\n"
                )
                sandbox.process.code_run(init_skills_code)
                print(f"[Daytona] Successfully pre-synced host skills/ to sandbox /skills for thread [{thread_id}]")
        except Exception as skills_sync_err:
            print(f"[Daytona] Skills pre-sync failed: {str(skills_sync_err)}")

        try:
            # 3. 将本地 workspace 下所有已有的用户上传文件（排除临时文件/隐藏文件）上传到沙盒中
            for filename in os.listdir(workspace_dir):
                local_filepath = os.path.join(workspace_dir, filename)
                # 排除目录、隐藏文件和临时脚本
                if os.path.isfile(local_filepath) and not filename.startswith(".") and not filename.startswith("_"):
                    try:
                        sandbox.fs.upload_file(local_filepath, f"./{filename}")
                    except Exception as upload_err:
                        print(f"[Daytona] Failed to upload local file {filename} to sandbox: {str(upload_err)}")

            # 4. 在沙盒中安全运行 Python 代码
            # Daytona 的 code_run 能直接接受 Python 脚本字符串
            exec_result = sandbox.process.code_run(code)

            # 5. 从沙盒递归下载所有新生成或修改后的文件回本地宿主机 workspace 目录，保留多级子文件夹目录结构
            try:
                _download_dir_recursive(sandbox, "./", workspace_dir)
            except Exception as fs_err:
                print(f"[Daytona] Failed to sync files back from sandbox: {str(fs_err)}")

            # 6. 解析输出结果
            exit_code = getattr(exec_result, "exit_code", 0)
            output_str = getattr(exec_result, "result", "")
            
            status_label = "成功" if exit_code == 0 else "失败 (存在错误)"
            
            return (
                f"=== 沙盒代码执行完毕 (状态: {status_label}, Exit Code: {exit_code}) ===\n"
                f"[标准输出与错误输出]:\n"
                f"{output_str.strip() if output_str.strip() else '(无任何输出)'}\n"
                f"==========================================================="
            )

        finally:
            # 7. 物理销毁沙盒，确保彻底清理，不积累文件垃圾，不泄露内存
            try:
                daytona.delete(sandbox)
            except Exception as cleanup_err:
                print(f"[Daytona] Failed to remove sandbox: {str(cleanup_err)}")
            
            # 8. 清理宿主机上的临时打包技能文件，防止磁盘脏文件堆积
            if local_tar_path and os.path.exists(local_tar_path):
                try:
                    os.remove(local_tar_path)
                except Exception:
                    pass

    except Exception as e:
        return f"沙盒执行过程中发生异常: {str(e)}"

# 创建 StructuredTool 接口以供 LangChain / DeepAgents 框架加载
sandbox_tool = StructuredTool.from_function(
    func=execute_python_in_sandbox,
    name="execute_python_in_sandbox",
    description=(
        "在安全的隔离沙盒中运行 Python 代码来处理、分析、编辑或写入文件。 "
        "使用此工具来读取/写入 Excel、Word、PDF 等文档。工作目录为 `./`。 "
        "如果用户上传了文件，它们已自动保存在当前工作目录下，你可以直接用代码读取并处理。"
    ),
    args_schema=SandboxExecutionInput,
)
