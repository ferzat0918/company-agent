@echo off
:: UMX Space Hardware System - One-click Deploy Launcher
:: [ Zero-Configuration | Pure ASCII | Cold Structure ]

:: Force UTF-8 terminal code page to prevent garbled Chinese characters on Windows
chcp 65001 >nul

echo ============================================================
echo           UMX SPACE HARDWARE SYSTEM - DEPLOY LAUNCHER
echo          [ Cold Structure & Emotional Light Field ]
echo ============================================================
echo.

:: Test if python command is functional on the system
python --version >nul 2>nul
if %errorlevel% equ 0 goto RUN_PYTHON

:: Test if python3 command is functional
python3 --version >nul 2>nul
if %errorlevel% equ 0 goto RUN_PYTHON3

:: Test if we already have a portable python configured
if exist "%~dp0.python_env\python.exe" goto RUN_PORTABLE_PYTHON

goto BOOTSTRAP_PYTHON

:RUN_PYTHON
python "%~dp0scripts\deploy\deploy.py"
if errorlevel 1 goto DEPLOYFAIL
exit /b 0

:RUN_PYTHON3
python3 "%~dp0scripts\deploy\deploy.py"
if errorlevel 1 goto DEPLOYFAIL
exit /b 0

:RUN_PORTABLE_PYTHON
"%~dp0.python_env\python.exe" "%~dp0scripts\deploy\deploy.py"
if errorlevel 1 goto DEPLOYFAIL
exit /b 0

:BOOTSTRAP_PYTHON
echo [WARN] System Python environment was not found on this machine!
echo.
echo ============================================================
echo   [UMX BOOTSTRAP] 正在为您全自动配置免安装绿色版 Python 环境...
echo ============================================================
echo.

if not exist "%~dp0.python_env" mkdir "%~dp0.python_env"

set "PY_URL_1=https://mirrors.tuna.tsinghua.edu.cn/python/3.11.8/python-3.11.8-embed-amd64.zip"
set "PY_URL_2=https://npmmirror.com/mirrors/python/3.11.8/python-3.11.8-embed-amd64.zip"
set "PY_URL_3=https://www.python.org/ftp/python/3.11.8/python-3.11.8-embed-amd64.zip"

echo 正在从 [清华大学镜像源] 极速拉取 Python 核心组件 (~10MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL_1%' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 30" >nul 2>nul
if %errorlevel% equ 0 goto EXTR_PY

echo 清华源超时，正在切换至 [阿里云镜像源] 拉取...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL_2%' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 30" >nul 2>nul
if %errorlevel% equ 0 goto EXTR_PY

echo 国内镜像源超时，正在尝试连接 [Python官方源] 拉取...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL_3%' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 45" >nul 2>nul
if %errorlevel% equ 0 goto EXTR_PY

echo.
echo [ERROR] 自动下载 Python 核心组件失败，请检查网络连接！
echo.
pause
exit /b 1

:EXTR_PY
echo 下载成功，正在解密释放绿色 Python 环境并配置库路径...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0.python_env\py.zip' -DestinationPath '%~dp0.python_env' -Force" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 解压 Python 环境失败！
    pause
    exit /b 1
)

:: Clean zip file
del "%~dp0.python_env\py.zip" >nul 2>nul

:: CRITICAL: Remove the restrictive embed path config to unlock full Python stdlib compatibility
if exist "%~dp0.python_env\python311._pth" del "%~dp0.python_env\python311._pth" >nul 2>nul

echo [SUCCESS] 绿色免安装 Python 环境已成功配齐！
echo.
goto RUN_PORTABLE_PYTHON

:DEPLOYFAIL
echo.
echo [ERROR] 部署脚本运行异常中断，错误码: %errorlevel%.
echo.
pause
exit /b %errorlevel%
