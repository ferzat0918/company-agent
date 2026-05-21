# UMX 一键终极打包与无损部署工具
# [ 极简守序 | 航空级硬核 | 物理持久卷防丢保障 ]

$PythonPath = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonPath) {
    Write-Host "[ERROR] 未检测到 Python 运行环境，请先安装 Python 3 并将其加入系统环境变量 (PATH) 中！" -ForegroundColor Red
    Exit 1
}

$ScriptPath = Join-Path $PSScriptRoot "scripts\deploy.py"
python $ScriptPath
