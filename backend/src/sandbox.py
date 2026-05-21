import os
import docker
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

SANDBOX_CONTAINER_NAME = "company-agent-sandbox"
WORKSPACE_DIR_NAME = "workspace"

class SandboxExecutionInput(BaseModel):
    code: str = Field(
        description=(
            "要在隔离 Docker 沙盒中运行的完整 Python 3.11 代码。 "
            "工作目录为 `/workspace`，已预装 pandas, openpyxl, python-docx, pdfplumber, matplotlib 等库。 "
            "所有输出结果必须通过 print() 打印出来，所有编辑或生成的文件请直接保存在当前目录下。"
        )
    )

def execute_python_in_sandbox(code: str) -> str:
    """在隔离的 company-agent-sandbox Docker 容器中执行 Python 代码。"""
    try:
        # 获取宿主机上的项目 workspace 绝对路径
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        workspace_dir = os.path.join(project_root, WORKSPACE_DIR_NAME)
        
        # 确保本地 workspace 目录存在
        os.makedirs(workspace_dir, exist_ok=True)
        
        # 1. 初始化 Docker 客户端
        # 当在 langgraph 容器中运行时，我们已挂载了 /var/run/docker.sock，所以可以直接连接
        client = docker.from_env()
        
        # 2. 获取沙盒容器
        try:
            container = client.containers.get(SANDBOX_CONTAINER_NAME)
        except docker.errors.NotFound:
            return (
                f"错误: 找不到沙盒容器 '{SANDBOX_CONTAINER_NAME}'。 "
                "请确认容器是否已通过 docker compose 启动。"
            )
        except Exception as docker_err:
            return f"连接 Docker 守护进程失败: {str(docker_err)}"
            
        # 3. 将 Agent 生成的代码写入临时文件 (避免长脚本命令行转义/传参超限问题)
        tmp_filename = ".tmp_agent_run.py"
        tmp_filepath = os.path.join(workspace_dir, tmp_filename)
        
        with open(tmp_filepath, "w", encoding="utf-8") as f:
            f.write(code)
            
        # 4. 在容器内的 /workspace 目录执行该 Python 脚本
        # 容器挂载了 workspace 目录，因此可以直接在容器内访问 /workspace/.tmp_agent_run.py
        exec_result = container.exec_run(
            cmd=f"python {tmp_filename}",
            workdir="/workspace",
            environment={"PYTHONIOENCODING": "utf-8"}
        )
        
        # 5. 物理清理临时脚本文件
        try:
            if os.path.exists(tmp_filepath):
                os.remove(tmp_filepath)
        except Exception:
            pass
            
        # 6. 解析输出结果
        exit_code = exec_result.exit_code
        output_str = exec_result.output.decode("utf-8", errors="ignore")
        
        status_label = "成功" if exit_code == 0 else "失败 (存在错误)"
        
        return (
            f"=== 沙盒代码执行完毕 (状态: {status_label}, Exit Code: {exit_code}) ===\n"
            f"[标准输出与错误输出]:\n"
            f"{output_str.strip() if output_str.strip() else '(无任何输出)'}\n"
            f"==========================================================="
        )
        
    except Exception as e:
        return f"沙盒执行过程中发生异常: {str(e)}"

# 创建 StructuredTool 接口以供 LangChain / DeepAgents 框架加载
sandbox_tool = StructuredTool.from_function(
    func=execute_python_in_sandbox,
    name="execute_python_in_sandbox",
    description=(
        "在安全的隔离沙盒中运行 Python 代码来处理、分析、编辑或写入文件。 "
        "使用此工具来读取/写入 Excel、Word、PDF 等文档。工作目录为 `/workspace`。 "
        "如果用户上传了文件，它们已自动保存在 `/workspace/<文件名>`，你可以直接用代码读取并处理。"
    ),
    args_schema=SandboxExecutionInput,
)
