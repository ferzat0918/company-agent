@echo off
:: UMX Space Hardware System - One-click Deploy Launcher
:: [ Minimalist & Cold Structure ]

echo ============================================================
echo           UMX SPACE HARDWARE SYSTEM - DEPLOY LAUNCHER
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 goto NOPYTHON

python "%~dp0scripts\deploy.py"
if errorlevel 1 goto DEPLOYFAIL
exit /b 0

:NOPYTHON
echo [ERROR] Python was not found in your system PATH!
echo Please install Python 3 and check "Add python.exe to PATH" first.
echo.
pause
exit /b 1

:DEPLOYFAIL
echo.
echo [ERROR] Deployment script failed with error code %errorlevel%.
echo.
pause
exit /b %errorlevel%
