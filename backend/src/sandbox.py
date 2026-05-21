import os
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

# Load environment variables (e.g. Daytona credentials)
load_dotenv()

try:
    from daytona_sdk import Daytona
except ImportError:
    from daytona import Daytona

WORKSPACE_DIR_NAME = "workspace"

class SandboxExecutionInput(BaseModel):
    code: str = Field(
        description=(
            "要在隔离 Daytona 沙盒中运行的完整 Python 3.11 代码。 "
            "工作目录为 `./`（已预装 pandas, openpyxl, python-docx, pdfplumber, matplotlib 等库）。 "
            "所有输出结果必须通过 print() 打印出来，所有编辑或生成的文件请直接保存在当前目录下。"
        )
    )

def execute_python_in_sandbox(code: str, config: RunnableConfig = None) -> str:
    """在隔离的 Daytona Cloud 沙盒环境中执行 Python 代码。"""
    try:
        # 获取宿主机上的项目 workspace 绝对路径
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        workspace_dir = os.path.join(project_root, WORKSPACE_DIR_NAME)
        
        # 确保本地 workspace 目录存在
        os.makedirs(workspace_dir, exist_ok=True)

        # 1. 初始化 Daytona 客户端
        # 会自动从环境变量中读取 DAYTONA_API_KEY 和 DAYTONA_API_URL
        daytona = Daytona()

        # 2. 动态创建安全的 Python 沙盒
        # 使用 ephemeral 沙盒，运行完在 finally 中自动销毁，确保无文件堆积和安全隔离
        sandbox = daytona.create()

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

            # 5. 从沙盒下载所有新生成或修改后的文件回本地宿主机 workspace 目录
            try:
                remote_files = sandbox.fs.list_files("./")
                for file_info in remote_files:
                    remote_filename = file_info.name
                    # 排除目录和隐藏文件
                    if not file_info.is_dir and not remote_filename.startswith("."):
                        local_filepath = os.path.join(workspace_dir, remote_filename)
                        try:
                            sandbox.fs.download_file(f"./{remote_filename}", local_filepath)
                        except Exception as download_err:
                            print(f"[Daytona] Failed to download file {remote_filename} from sandbox: {str(download_err)}")
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
