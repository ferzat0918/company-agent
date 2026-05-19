@echo off
REM ──────────────────────────────────────────────────────────
REM  Company-Agent Smart Deploy — double-click to run
REM ──────────────────────────────────────────────────────────
REM  Launches deploy.ps1 with execution policy bypass so it
REM  works even on machines that haven't enabled PS scripts.
REM ──────────────────────────────────────────────────────────

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
