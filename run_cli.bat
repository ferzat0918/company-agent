@echo off
:: WeChat PC RPA Terminal Client - Double-click Launcher
:: Force UTF-8 terminal code page to prevent garbled Chinese characters on Windows
chcp 65001 >nul

echo ============================================================
echo         WECHAT PC RPA TERMINAL CLIENT - LAUNCHER
echo ============================================================
echo.

:: 1. Try running using portable python first if it exists
if exist "%~dp0.python_env\python.exe" (
    echo [UMX] 检测到本地免安装 Python 环境，正在启动...
    "%~dp0.python_env\python.exe" "%~dp0wechat_rpa_cli.py"
    goto END
)

:: 2. Try global python
python --version >nul 2>nul
if %errorlevel% equ 0 (
    echo [UMX] 检测到系统全局 Python 环境，正在启动...
    python "%~dp0wechat_rpa_cli.py"
    goto END
)

:: 3. Try global python3
python3 --version >nul 2>nul
if %errorlevel% equ 0 (
    echo [UMX] 检测到系统全局 Python3 环境，正在启动...
    python3 "%~dp0wechat_rpa_cli.py"
    goto END
)

echo [ERROR] 未找到可用的 Python 运行环境！
echo 请确保已在该电脑上运行过 deploy.bat 进行环境初始化，或系统中已安装 Python。
echo.
pause

:END
if errorlevel 1 (
    echo.
    echo [ERROR] RPA 客户端异常退出，错误代码: %errorlevel%
    pause
)
