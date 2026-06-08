@echo off
:: UMX 自动部署 — Windows 计划任务管理工具
:: 用法:
::   auto_deploy_cli.bat install    注册每天凌晨 4:00 的计划任务
::   auto_deploy_cli.bat uninstall  移除计划任务
::   auto_deploy_cli.bat run        立即手动执行一次部署检查
::   auto_deploy_cli.bat logs       查看部署日志
::   auto_deploy_cli.bat status     查看计划任务状态

chcp 65001 >nul

set "TASK_NAME=UMX_AutoDeploy"
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\.."
set "LOG_FILE=%REPO_ROOT%\logs\auto_deploy.log"
set "DEPLOY_SCRIPT=%SCRIPT_DIR%auto_deploy.py"

if "%1"=="" goto USAGE
if "%1"=="install" goto INSTALL
if "%1"=="uninstall" goto UNINSTALL
if "%1"=="run" goto RUN
if "%1"=="logs" goto LOGS
if "%1"=="status" goto STATUS
goto USAGE

:INSTALL
echo ============================================================
echo   [UMX] 正在注册每日凌晨 4:00 自动部署计划任务...
echo ============================================================
echo.

:: 先删除旧任务（如果存在）
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>nul

:: 检测 Python 路径
where python >nul 2>nul
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('where python') do set "PYTHON_PATH=%%i"
) else if exist "%REPO_ROOT%\.python_env\python.exe" (
    set "PYTHON_PATH=%REPO_ROOT%\.python_env\python.exe"
) else (
    echo [ERROR] 未找到 Python，请先安装 Python 或运行一次 deploy.bat
    pause
    exit /b 1
)

echo 使用 Python: %PYTHON_PATH%
echo 部署脚本:    %DEPLOY_SCRIPT%
echo 计划时间:    每天 04:00
echo.

:: 创建计划任务
:: /sc daily  = 每天
:: /st 04:00  = 凌晨 4 点
:: /rl highest = 以最高权限运行（需要 docker 权限）
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "\"%PYTHON_PATH%\" \"%DEPLOY_SCRIPT%\"" ^
    /sc daily ^
    /st 04:00 ^
    /rl highest ^
    /f

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] 计划任务已成功注册！
    echo.
    echo    任务名称: %TASK_NAME%
    echo    执行时间: 每天凌晨 04:00
    echo    部署日志: %LOG_FILE%
    echo.
    echo    管理命令:
    echo      auto_deploy_cli.bat status     查看任务状态
    echo      auto_deploy_cli.bat logs       查看部署日志
    echo      auto_deploy_cli.bat run        立即手动触发
    echo      auto_deploy_cli.bat uninstall  移除计划任务
) else (
    echo.
    echo [ERROR] 注册计划任务失败！请尝试以管理员身份运行此脚本。
)
echo.
pause
exit /b 0

:UNINSTALL
echo 正在移除计划任务 [%TASK_NAME%]...
schtasks /delete /tn "%TASK_NAME%" /f
if %errorlevel% equ 0 (
    echo [SUCCESS] 计划任务已移除。
) else (
    echo [WARN] 任务不存在或移除失败。
)
pause
exit /b 0

:RUN
echo ============================================================
echo   [UMX] 手动触发部署检查...
echo ============================================================
echo.

:: 检测 Python
where python >nul 2>nul
if %errorlevel% equ 0 (
    python "%DEPLOY_SCRIPT%"
) else if exist "%REPO_ROOT%\.python_env\python.exe" (
    "%REPO_ROOT%\.python_env\python.exe" "%DEPLOY_SCRIPT%"
) else (
    echo [ERROR] 未找到 Python
    pause
    exit /b 1
)
echo.
pause
exit /b 0

:LOGS
if not exist "%LOG_FILE%" (
    echo [INFO] 日志文件尚不存在: %LOG_FILE%
    pause
    exit /b 0
)
echo ============================================================
echo   [UMX] 自动部署日志 (最近 50 行)
echo ============================================================
echo.
powershell -NoProfile -Command "Get-Content '%LOG_FILE%' -Tail 50 -Encoding UTF8"
echo.
echo ============================================================
echo   完整日志路径: %LOG_FILE%
echo ============================================================
pause
exit /b 0

:STATUS
echo ============================================================
echo   [UMX] 计划任务状态
echo ============================================================
echo.
schtasks /query /tn "%TASK_NAME%" /v /fo list 2>nul
if %errorlevel% neq 0 (
    echo [INFO] 计划任务 [%TASK_NAME%] 未注册。运行 "auto_deploy_cli.bat install" 来创建。
)
echo.
pause
exit /b 0

:USAGE
echo ============================================================
echo   UMX 自动部署管理工具
echo ============================================================
echo.
echo 用法: auto_deploy_cli.bat [命令]
echo.
echo 可用命令:
echo   install     注册每天凌晨 4:00 的自动部署计划任务
echo   uninstall   移除自动部署计划任务
echo   run         立即手动执行一次部署检查
echo   logs        查看部署日志
echo   status      查看计划任务状态
echo.
pause
exit /b 0
