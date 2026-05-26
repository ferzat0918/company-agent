@echo off
:: WeChat PC RPA Terminal Client - Double-click Launcher & Installer
:: Force UTF-8 terminal code page to prevent garbled Chinese characters on Windows
chcp 65001 >nul

echo ============================================================
echo         WECHAT PC RPA TERMINAL CLIENT - LAUNCHER
echo          [ Zero Configuration | Pure Terminal ]
echo ============================================================
echo.

:: 1. Check if we need to bootstrap python
if not exist "%~dp0.python_env\python.exe" (
    echo [WARN] 在此电脑上未检测到 Python 运行环境！
    echo.
    echo ============================================================
    echo   [UMX BOOTSTRAP] 正在为您全自动配置免安装绿色版 Python 环境...
    echo ============================================================
    echo.
    
    mkdir "%~dp0.python_env" >nul 2>nul
    
    set "PY_URL=https://mirrors.tuna.tsinghua.edu.cn/python/3.11.8/python-3.11.8-embed-amd64.zip"
    echo 正在从镜像源极速下载绿色版 Python (~10MB)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 30"
    if errorlevel 1 (
        echo [WARN] 清华源下载超时，正在尝试从官方源下载...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-embed-amd64.zip' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 45"
    )
    
    echo 正在释放解压 Python 运行环境...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0.python_env\py.zip' -DestinationPath '%~dp0.python_env' -Force"
    del "%~dp0.python_env\py.zip" >nul 2>nul
    
    :: Unlock full standard library and site-packages compatibility
    if exist "%~dp0.python_env\python311._pth" del "%~dp0.python_env\python311._pth" >nul 2>nul
    
    echo 正在获取并装载 pip 包管理器 (Tsinghua 源加速)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%~dp0.python_env\get-pip.py'"
    "%~dp0.python_env\python.exe" "%~dp0.python_env\get-pip.py" --index-url https://pypi.tuna.tsinghua.edu.cn/simple --no-warn-script-location
    del "%~dp0.python_env\get-pip.py" >nul 2>nul
    
    echo [SUCCESS] 绿色免安装 Python 环境配置完毕！
    echo.
)

:: 2. Check and Install missing dependencies in portable python environment
if exist "%~dp0.python_env\python.exe" (
    "%~dp0.python_env\python.exe" -c "import wxauto, jwt, httpx, dotenv" >nul 2>nul
    if errorlevel 1 (
        echo [UMX] 正在全自动配置并安装所需依赖库，请稍候...
        "%~dp0.python_env\python.exe" -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple wxauto pyjwt httpx python-dotenv --no-warn-script-location
        if errorlevel 1 (
            echo [UMX] 依赖库自动配置失败，正在尝试从官方源安装...
            "%~dp0.python_env\python.exe" -m pip install wxauto pyjwt httpx python-dotenv --no-warn-script-location
        )
    )
    
    echo [UMX] 依赖库检查完毕，正在启动 RPA 终端服务...
    "%~dp0.python_env\python.exe" "%~dp0wechat_rpa_cli.py"
    goto END
)

:: 3. Fallback to global python if portable python was somehow not created
python --version >nul 2>nul
if %errorlevel% equ 0 (
    python -c "import wxauto, jwt, httpx, dotenv" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [UMX] 正在使用系统全局 pip 自动配置依赖库...
        python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple wxauto pyjwt httpx python-dotenv
    )
    echo [UMX] 依赖库检查完毕，正在启动 RPA 终端服务...
    python "%~dp0wechat_rpa_cli.py"
    goto END
)

echo [ERROR] 未找到可用的 Python 运行环境且自动配置失败！
pause

:END
if errorlevel 1 (
    echo.
    echo [ERROR] RPA 客户端异常退出，错误代码: %errorlevel%
    pause
)
