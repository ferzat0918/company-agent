@echo off
:: WeChat PC RPA Terminal Client - Double-click Launcher & Installer
chcp 65001 >nul

echo ============================================================
echo         WECHAT PC RPA TERMINAL CLIENT - LAUNCHER
echo          [ Zero Configuration | Pure Terminal ]
echo ============================================================
echo.

:: 1. Check if portable python exists, if so jump to dependency check
if exist "%~dp0.python_env\python.exe" goto CHECK_DEPS

:: 2. Bootstrap python env
echo [WARN] No Python environment detected!
echo [UMX BOOTSTRAP] Auto-configuring green portable Python...
echo.

mkdir "%~dp0.python_env" >nul 2>nul

set "PY_URL=https://mirrors.tuna.tsinghua.edu.cn/python/3.11.8/python-3.11.8-embed-amd64.zip"
echo Downloading green Python from mirror (~10MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 30"
if errorlevel 1 goto BOOTSTRAP_BACKUP
goto UNZIP_PY

:BOOTSTRAP_BACKUP
echo [WARN] Tsinghua mirror timed out, trying backup official source...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-embed-amd64.zip' -OutFile '%~dp0.python_env\py.zip' -TimeoutSec 45"
if errorlevel 1 goto NO_PY_ERROR

:UNZIP_PY
echo Unzipping Python environment...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0.python_env\py.zip' -DestinationPath '%~dp0.python_env' -Force"
del "%~dp0.python_env\py.zip" >nul 2>nul

:: Unlock site-packages
if exist "%~dp0.python_env\python311._pth" del "%~dp0.python_env\python311._pth" >nul 2>nul

echo Installing pip package manager...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%~dp0.python_env\get-pip.py'"
"%~dp0.python_env\python.exe" "%~dp0.python_env\get-pip.py" --index-url https://pypi.tuna.tsinghua.edu.cn/simple --no-warn-script-location
del "%~dp0.python_env\get-pip.py" >nul 2>nul
echo [SUCCESS] Green Python environment configured!
echo.

:CHECK_DEPS
if not exist "%~dp0.python_env\python.exe" goto SYSTEM_FALLBACK

:: Check portable python deps
"%~dp0.python_env\python.exe" -c "import wxauto, jwt, httpx, dotenv" >nul 2>nul
if errorlevel 1 goto INSTALL_PORTABLE_DEPS
goto RUN_PORTABLE

:INSTALL_PORTABLE_DEPS
echo [UMX] Auto-installing required packages, please wait...
"%~dp0.python_env\python.exe" -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple wxauto pyjwt httpx python-dotenv --no-warn-script-location
if errorlevel 1 goto INSTALL_PORTABLE_DEPS_BACKUP
goto RUN_PORTABLE

:INSTALL_PORTABLE_DEPS_BACKUP
echo [UMX] Fallback installation from official source...
"%~dp0.python_env\python.exe" -m pip install wxauto pyjwt httpx python-dotenv --no-warn-script-location
if errorlevel 1 goto DEPS_FAIL_ERROR

:RUN_PORTABLE
echo [UMX] Starting WeChat RPA Terminal Service...
"%~dp0.python_env\python.exe" "%~dp0scripts\rpa\wechat_rpa_v4.py"
goto END

:SYSTEM_FALLBACK
python --version >nul 2>nul
if errorlevel 1 goto NO_PY_ERROR

:: Check global deps
python -c "import wxauto, jwt, httpx, dotenv" >nul 2>nul
if errorlevel 1 goto INSTALL_GLOBAL_DEPS
goto RUN_GLOBAL

:INSTALL_GLOBAL_DEPS
echo [UMX] Installing dependencies via global pip...
python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple wxauto pyjwt httpx python-dotenv
if errorlevel 1 goto DEPS_FAIL_ERROR

:RUN_GLOBAL
echo [UMX] Starting WeChat RPA Terminal Service...
python "%~dp0scripts\rpa\wechat_rpa_v4.py"
goto END

:NO_PY_ERROR
echo [ERROR] No Python environment found!
echo Please make sure you are running on Windows and have internet access to download Python.
pause
exit /b 1

:DEPS_FAIL_ERROR
echo [ERROR] Failed to install required packages!
pause
exit /b 1

:END
if errorlevel 1 (
    echo.
    echo [ERROR] Client exited with error code: %errorlevel%
    pause
)
