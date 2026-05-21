$PythonPath = Get-Command python -ErrorAction SilentlyContinue
$PortablePython = Join-Path $PSScriptRoot ".python_env\python.exe"

if (Test-Path $PortablePython) {
    $PythonCmd = $PortablePython
} elseif ($PythonPath) {
    $PythonCmd = "python"
} else {
    Write-Host "[WARN] 系统未检测到全局 Python，正在通过 deploy.bat 引导自动拉取绿色版 Python 环境..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "deploy.bat")
    Exit $LASTEXITCODE
}

$ScriptPath = Join-Path $PSScriptRoot "scripts\deploy.py"
& $PythonCmd $ScriptPath

