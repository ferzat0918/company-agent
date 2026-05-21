@echo off
:: UMX 响应式空间硬件系统 — 一键终极打包与无损部署脚本启动器
:: [ 极简守序 | 航空级硬核 | 物理持久卷防丢保障 ]
chcp 65001 >nul

echo ============================================================
echo           UMX SPACE HARDWARE SYSTEM - DEPLOY LAUNCHER
echo          [ Cold Structure & Emotional Light Field ]
echo ============================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Python 运行环境！
    echo 请先安装 Python 3 并勾选 "Add python.exe to PATH"（加入系统环境变量）选项后再试。
    echo.
    pause
    exit /b 1
)

python "%~dp0scripts\deploy.py"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] 部署脚本异常中断，错误码: %errorlevel%
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo [SUCCESS] UMX 一键打包与无损部署已圆满成功！
echo.
pause
