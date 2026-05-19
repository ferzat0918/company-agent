<#
.SYNOPSIS
    Smart deployment script for company-agent.
    Pulls latest code from GitHub, detects changes, and restarts only
    the containers that need it.

.DESCRIPTION
    Decision logic:
      - backend/pyproject.toml changed    → REBUILD langgraph (pip install)
      - infra/Dockerfile.langgraph changed → REBUILD langgraph
      - backend/src/** changed            → langgraph dev auto-reloads (bind-mount)
      - prompts/** changed                → RESTART langgraph (loaded at startup)
      - skills/** changed                 → RESTART langgraph (loaded at startup)
      - frontend/agent-chat-ui/out/**     → RESTART frontend (nginx refresh)
      - infra/docker-compose.yml changed  → docker compose up -d (reconcile)
      - infra/kong.yml changed            → RESTART kong
      - infra/nginx.conf changed          → RESTART frontend (nginx)
      - infra/Dockerfile.frontend changed → REBUILD frontend

.NOTES
    Place this script anywhere on the deploy machine.
    Usage:  .\deploy.ps1 [-ProjectRoot "D:\agent-service-git\company-agent"]
#>

# ╔═══════════════════════════════════════════════════════════════════╗
# ║  ██  SAFETY RULES — DO NOT REMOVE OR MODIFY THIS BLOCK  ██      ║
# ║                                                                   ║
# ║  This script MUST NEVER:                                          ║
# ║    1. Delete any Docker volume    (docker volume rm)              ║
# ║    2. Use "docker compose down"   (destroys containers)           ║
# ║    3. Use "docker system prune"   (deletes unused data)           ║
# ║    4. Touch any database          (psql, DROP, DELETE, TRUNCATE)  ║
# ║    5. Remove langgraph-data       (contains thread index)         ║
# ║    6. Remove postgres-data        (contains all chat history)     ║
# ║    7. Remove storage-data         (contains uploaded files)       ║
# ║                                                                   ║
# ║  ALLOWED operations (safe):                                       ║
# ║    ✓ git fetch / git pull                                         ║
# ║    ✓ docker compose build         (rebuilds image only)           ║
# ║    ✓ docker compose up -d         (starts/updates containers)     ║
# ║    ✓ docker compose restart       (restarts running container)    ║
# ║    ✓ docker compose ps            (read-only status check)        ║
# ╚═══════════════════════════════════════════════════════════════════╝

param(
    [string]$ProjectRoot = ""
)

# ── Safety self-check ────────────────────────────────────────────
# Scans this script's own content for forbidden patterns.
# If someone accidentally adds a dangerous command, the script
# will refuse to run.
function Assert-ScriptSafety {
    $scriptContent = Get-Content $PSCommandPath -Raw
    $forbidden = @(
        "volume rm",
        "volume remove",
        "volume prune",
        "compose down",
        "system prune",
        "DROP TABLE",
        "DROP DATABASE",
        "TRUNCATE",
        "DELETE FROM",
        "rm -rf",
        "Remove-Item.*postgres",
        "Remove-Item.*langgraph",
        "Remove-Item.*storage"
    )
    foreach ($pattern in $forbidden) {
        # Skip the safety check block itself (these patterns appear as strings in the check list)
        $matches_found = [regex]::Matches($scriptContent, [regex]::Escape($pattern))
        # Each pattern appears exactly once in the $forbidden array definition above.
        # If it appears MORE than once, it means someone added it as actual code.
        if ($matches_found.Count -gt 1) {
            Write-Host ""
            Write-Host "  ╔═══════════════════════════════════════════════╗" -ForegroundColor Red
            Write-Host "  ║  SAFETY VIOLATION DETECTED — ABORTING         ║" -ForegroundColor Red
            Write-Host "  ║  Forbidden pattern found: $pattern" -ForegroundColor Red
            Write-Host "  ║  This script must NEVER touch data/volumes.   ║" -ForegroundColor Red
            Write-Host "  ╚═══════════════════════════════════════════════╝" -ForegroundColor Red
            Write-Host ""
            Read-Host "Press Enter to exit"
            exit 99
        }
    }
}

Assert-ScriptSafety

# ── Helpers ──────────────────────────────────────────────────────
function Write-Step  { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Skip  { param([string]$msg) Write-Host "  - $msg" -ForegroundColor DarkGray }
function Write-Warn  { param([string]$msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$msg) Write-Host "  ✗ $msg" -ForegroundColor Red }

# ── Resolve project root ────────────────────────────────────────
if (-not $ProjectRoot) {
    # Auto-detect: walk up from script location to find .git
    $candidate = (Get-Item $PSScriptRoot).Parent.Parent.FullName
    if (Test-Path "$candidate\.git") {
        $ProjectRoot = $candidate
    } else {
        # Fallback: assume script is in infra/scripts/
        $ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    }
}

if (-not (Test-Path "$ProjectRoot\.git")) {
    Write-Err "Cannot find git repo at $ProjectRoot"
    Read-Host "Press Enter to exit"
    exit 1
}

$InfraDir = Join-Path $ProjectRoot "infra"
$EnvFile  = Join-Path $ProjectRoot ".env"

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║       Company-Agent Smart Deploy                     ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host "  Project: $ProjectRoot"
Write-Host "  Time:    $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# ── 1. Fetch latest from origin ─────────────────────────────────
Write-Step "Fetching latest code from GitHub..."
Push-Location $ProjectRoot
try {
    git fetch origin main 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git fetch failed. Check your network connection."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Fetch complete"

    # ── 2. Check for changes ─────────────────────────────────────
    Write-Step "Comparing local vs remote..."
    $changedFiles = git diff HEAD origin/main --name-only 2>&1
    
    if (-not $changedFiles -or $changedFiles.Count -eq 0) {
        Write-Ok "Already up to date. Nothing to do!"
        Read-Host "Press Enter to exit"
        exit 0
    }

    # Display changed files
    Write-Host "  Changed files:" -ForegroundColor Yellow
    foreach ($f in $changedFiles) {
        Write-Host "    • $f" -ForegroundColor DarkYellow
    }

    # ── 3. Pull changes ──────────────────────────────────────────
    Write-Step "Pulling changes..."
    git pull origin main 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git pull failed. You may have local conflicts."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Pull complete"

    # ── 4. Analyze changes ───────────────────────────────────────
    Write-Step "Analyzing changes..."
    
    $rebuildLanggraph  = $false
    $restartLanggraph  = $false
    $rebuildFrontend   = $false
    $restartFrontend   = $false
    $restartKong       = $false
    $composeReconcile  = $false
    $autoReload        = $false  # bind-mounted dirs, watchfiles handles it

    foreach ($file in $changedFiles) {
        switch -Wildcard ($file) {
            # ── Langgraph: need full rebuild ──
            "backend/pyproject.toml"      { $rebuildLanggraph = $true }
            "infra/Dockerfile.langgraph"  { $rebuildLanggraph = $true }

            # ── Langgraph: bind-mounted .py files, watchfiles auto-reloads ──
            "backend/src/*"    { $autoReload = $true }

            # ── Langgraph: prompts/skills are read at startup, not watched ──
            # .md files are NOT monitored by watchfiles, need restart
            "prompts/*"         { $restartLanggraph = $true }
            "skills/*"          { $restartLanggraph = $true }
            "backend/scripts/*" { $restartLanggraph = $true }

            # ── Frontend: static files are bind-mounted ──
            "frontend/agent-chat-ui/out/*" { $restartFrontend = $true }

            # ── Frontend: need rebuild ──
            "infra/Dockerfile.frontend"    { $rebuildFrontend = $true }

            # ── Infra config changes ──
            "infra/docker-compose.yml"     { $composeReconcile = $true }
            "infra/docker-compose.prod.yml" { $composeReconcile = $true }
            "infra/kong.yml"               { $restartKong = $true }
            "infra/nginx.conf"             { $restartFrontend = $true }
        }
    }

    # If rebuilding, no need to separately restart
    if ($rebuildLanggraph) { $restartLanggraph = $false; $autoReload = $false }

    # ── 5. Report plan ───────────────────────────────────────────
    Write-Step "Deployment plan:"
    
    $hasAction = $false
    
    if ($rebuildLanggraph) {
        Write-Warn "REBUILD langgraph container (dependencies or Dockerfile changed)"
        $hasAction = $true
    }
    if ($restartLanggraph) {
        Write-Warn "RESTART langgraph container (scripts changed)"
        $hasAction = $true
    }
    if ($autoReload) {
        Write-Ok "Langgraph will AUTO-RELOAD (bind-mounted files changed, watchfiles detects it)"
    }
    if ($rebuildFrontend) {
        Write-Warn "REBUILD frontend container (Dockerfile changed)"
        $hasAction = $true
    }
    if ($restartFrontend) {
        Write-Warn "RESTART frontend container (static files or nginx config changed)"
        $hasAction = $true
    }
    if ($restartKong) {
        Write-Warn "RESTART kong container (routing config changed)"
        $hasAction = $true
    }
    if ($composeReconcile) {
        Write-Warn "RECONCILE all containers (docker-compose.yml changed)"
        $hasAction = $true
    }
    if (-not $hasAction -and -not $autoReload) {
        Write-Ok "No container action needed (docs/config-only changes)"
        Read-Host "Press Enter to exit"
        exit 0
    }
    if (-not $hasAction -and $autoReload) {
        Write-Ok "All changes are in bind-mounted dirs. Langgraph auto-reloads — no restart needed!"
        Read-Host "Press Enter to exit"
        exit 0
    }

    # ── 6. Confirm ───────────────────────────────────────────────
    Write-Host ""
    $confirm = Read-Host "  Proceed? (Y/n)"
    if ($confirm -and $confirm -notmatch "^[Yy]") {
        Write-Warn "Cancelled by user."
        exit 0
    }

    # ── 7. Execute ───────────────────────────────────────────────
    Push-Location $InfraDir
    try {
        # Check .env exists
        if (-not (Test-Path $EnvFile)) {
            Write-Err ".env not found at $EnvFile"
            Read-Host "Press Enter to exit"
            exit 1
        }

        $composeCmd = "docker compose --env-file `"$EnvFile`""

        if ($composeReconcile) {
            Write-Step "Reconciling all containers..."
            if ($rebuildLanggraph -or $rebuildFrontend) {
                Invoke-Expression "$composeCmd up -d --build"
            } else {
                Invoke-Expression "$composeCmd up -d"
            }
            Write-Ok "Compose reconcile complete"
        }
        else {
            # Rebuild specific containers
            if ($rebuildLanggraph) {
                Write-Step "Rebuilding langgraph container..."
                Invoke-Expression "$composeCmd build langgraph"
                Write-Ok "Build complete"
                Invoke-Expression "$composeCmd up -d langgraph"
                Write-Ok "Langgraph restarted with new image"
            }
            elseif ($restartLanggraph) {
                Write-Step "Restarting langgraph container..."
                Invoke-Expression "$composeCmd restart langgraph"
                Write-Ok "Langgraph restarted"
            }

            if ($rebuildFrontend) {
                Write-Step "Rebuilding frontend container..."
                Invoke-Expression "$composeCmd build frontend"
                Write-Ok "Build complete"
                Invoke-Expression "$composeCmd up -d frontend"
                Write-Ok "Frontend restarted with new image"
            }
            elseif ($restartFrontend) {
                Write-Step "Restarting frontend container..."
                Invoke-Expression "$composeCmd restart frontend"
                Write-Ok "Frontend restarted"
            }

            if ($restartKong) {
                Write-Step "Restarting kong container..."
                Invoke-Expression "$composeCmd restart kong"
                Write-Ok "Kong restarted"
            }
        }

        # ── 8. Health check ──────────────────────────────────────
        Write-Step "Checking container status..."
        Start-Sleep -Seconds 3
        Invoke-Expression "$composeCmd ps --format 'table {{.Name}}\t{{.Status}}'"

    } finally {
        Pop-Location
    }

} finally {
    Pop-Location
}

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║       Deploy complete!                                ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host "  Finished at $(Get-Date -Format 'HH:mm:ss')"
Write-Host ""
Read-Host "Press Enter to exit"
