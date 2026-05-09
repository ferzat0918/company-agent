<#
.SYNOPSIS
    One-time setup script for Company Agent infra on Windows 11 + WSL2 + Docker Desktop.
.DESCRIPTION
    - Checks WSL2 status
    - Prints Docker Desktop installation URL
    - Creates .env from .env.example (if not exists)
    - Runs docker compose up -d in infra/
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
$EnvExample = Join-Path $ProjectRoot ".env.example"
$EnvFile = Join-Path $ProjectRoot ".env"
$InfraDir = Join-Path $ProjectRoot "infra"

Write-Host "=== Company Agent - Infra Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check WSL2 status ───────────────────────────────────
Write-Host "[1/4] Checking WSL2 status..." -ForegroundColor Yellow
try {
    $wslStatus = wsl --status 2>&1
    Write-Host $wslStatus -ForegroundColor Gray

    $wslVersion = wsl -l -v 2>&1
    Write-Host "Installed distributions:" -ForegroundColor Green
    Write-Host $wslVersion -ForegroundColor Gray
}
catch {
    Write-Host "WSL is not installed or not available." -ForegroundColor Red
    Write-Host "Please install WSL2 first: https://learn.microsoft.com/en-us/windows/wsl/install" -ForegroundColor Yellow
}

Write-Host ""

# ── Step 2: Print Docker Desktop URL ────────────────────────────
Write-Host "[2/4] Docker Desktop requirement..." -ForegroundColor Yellow
Write-Host "Make sure Docker Desktop is installed and running." -ForegroundColor White
Write-Host "Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan

try {
    $dockerVersion = docker --version 2>&1
    Write-Host "Detected: $dockerVersion" -ForegroundColor Green
}
catch {
    Write-Host "Docker CLI not found. Please install Docker Desktop." -ForegroundColor Red
}

Write-Host ""

# ── Step 3: Create .env from template ──────────────────────────
Write-Host "[3/4] Creating .env from template..." -ForegroundColor Yellow

if (-not (Test-Path $EnvExample)) {
    Write-Host "ERROR: .env.example not found at $EnvExample" -ForegroundColor Red
    exit 1
}

if (Test-Path $EnvFile) {
    Write-Host ".env already exists at $EnvFile — skipping." -ForegroundColor Green
}
else {
    Copy-Item -Path $EnvExample -Destination $EnvFile
    Write-Host "Created .env from .env.example — please edit $EnvFile with your actual secrets." -ForegroundColor Green
}

Write-Host ""

# ── Step 4: Docker Compose up ───────────────────────────────────
Write-Host "[4/4] Starting Docker Compose..." -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $InfraDir "docker-compose.yml"))) {
    Write-Host "ERROR: docker-compose.yml not found at $InfraDir" -ForegroundColor Red
    exit 1
}

Push-Location $InfraDir
try {
    docker compose up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== Setup complete! ===" -ForegroundColor Cyan
        Write-Host "Supabase Studio: http://localhost:8081" -ForegroundColor Green
        Write-Host "API Gateway:     http://localhost:8000" -ForegroundColor Green
    }
    else {
        Write-Host "docker compose up failed. Check the output above." -ForegroundColor Red
    }
}
finally {
    Pop-Location
}
