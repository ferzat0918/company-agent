@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   WeChat RPA 全局命令一键安装
echo ========================================

:: Get the directory where this script lives
set "RPA_DIR=%~dp0"
:: Remove trailing backslash
set "RPA_DIR=%RPA_DIR:~0,-1%"

:: Check if already in PATH
echo %PATH% | findstr /I /C:"%RPA_DIR%" >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 已经安装过了，rpa 命令可用。
    goto :done
)

:: Add to user PATH permanently
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USER_PATH=%%B"
if not defined USER_PATH set "USER_PATH="

setx Path "%USER_PATH%;%RPA_DIR%" >nul 2>&1

if %errorlevel%==0 (
    echo ✅ 安装成功！已将 rpa 命令加入系统 PATH。
    echo    路径: %RPA_DIR%
    echo.
    echo ⚠️  请新开一个终端窗口，然后即可使用：
    echo    rpa start    启动 RPA 后台服务
    echo    rpa stop     停止
    echo    rpa status   查看状态
    echo    rpa logs     实时查看日志
    echo    rpa restart  重启
) else (
    echo ❌ 安装失败，请手动执行：
    echo    setx Path "%%PATH%%;%RPA_DIR%"
)

:done
pause
