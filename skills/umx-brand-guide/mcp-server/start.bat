@echo off
cd /d "%~dp0"

netstat -ano | findstr ":3737 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo UMX Brand MCP Server is already running on port 3737.
    echo MCP   ^>  http://192.168.1.145:3737/mcp
    echo Files ^>  http://192.168.1.145:3737/assets/
    pause
    exit /b 0
)

set PUBLIC_URL=http://192.168.1.145:3737
echo UMX Brand MCP Server starting...
echo MCP   ^>  http://192.168.1.145:3737/mcp
echo Files ^>  http://192.168.1.145:3737/assets/
echo.
node dist/index.js
pause
