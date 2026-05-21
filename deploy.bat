@echo off
:: UMX Space Hardware System - One-click Deploy Launcher
:: [ Minimalist & Cold Structure ]

echo ============================================================
echo           UMX SPACE HARDWARE SYSTEM - DEPLOY LAUNCHER
echo ============================================================
echo.

:: Test if python command is functional and not a broken stub
python --version >nul 2>nul
if %errorlevel% equ 0 goto RUN_PYTHON

:: Test if python3 command is functional
python3 --version >nul 2>nul
if %errorlevel% equ 0 goto RUN_PYTHON3

goto NOPYTHON

:RUN_PYTHON
python "%~dp0scripts\deploy.py"
if errorlevel 1 goto DEPLOYFAIL
exit /b 0

:RUN_PYTHON3
python3 "%~dp0scripts\deploy.py"
if errorlevel 1 goto DEPLOYFAIL
exit /b 0

:NOPYTHON
echo [ERROR] Python was not found in your system PATH!
echo.
echo Please make sure you have:
echo 1. Installed Python 3 (from python.org) on the host machine.
echo 2. Checked "Add python.exe to PATH" during the installation.
echo.
pause
exit /b 1

:DEPLOYFAIL
echo.
echo [ERROR] Deployment script failed with error code %errorlevel%.
echo.
pause
exit /b %errorlevel%
