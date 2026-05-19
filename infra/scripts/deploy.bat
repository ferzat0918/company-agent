@echo off
REM  Company-Agent Smart Deploy
REM  Double-click to sync code from GitHub and update containers.
chcp 65001 >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
