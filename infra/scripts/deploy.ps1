<#
.SYNOPSIS
    Smart deployment script for company-agent.
    Handles everything from first-time clone to incremental updates.

.DESCRIPTION
    This script can be run standalone on any machine. It will:
      1. Clone the repo if it doesn't exist
      2. Create .env from template if missing
      3. Build all containers on first run
      4. Do smart incremental updates on subsequent runs

    Decision logic for incremental updates:
      - backend/pyproject.toml changed    -> REBUILD langgraph (pip install)
      - infra/Dockerfile.langgraph changed -> REBUILD langgraph
      - backend/src/** changed            -> langgraph dev auto-reloads (bind-mount)
      - prompts/** changed                -> RESTART langgraph (loaded at startup)
      - skills/** changed                 -> RESTART langgraph (loaded at startup)
      - frontend/agent-chat-ui/out/**     -> RESTART frontend (nginx refresh)
      - infra/docker-compose.yml changed  -> docker compose up -d (reconcile)
      - infra/kong.yml changed            -> RESTART kong
      - infra/nginx.conf changed          -> RESTART frontend (nginx)
      - infra/Dockerfile.frontend changed -> REBUILD frontend

.NOTES
    Usage:  .\deploy.ps1 [-ProjectRoot "D:\agent-service-git\company-agent"]
    Or just double-click deploy.bat
#>

# ====================================================================
#   SAFETY RULES -- DO NOT REMOVE OR MODIFY THIS BLOCK
#
#   This script MUST NEVER:
#     1. Delete any Docker volume
#     2. Run docker compose down    (destroys containers)
#     3. Run docker system prune    (deletes unused data)
#     4. Touch any database         (psql, DROP, DELETE, TRUNCATE)
#     5. Remove langgraph-data      (contains thread index)
#     6. Remove postgres-data       (contains all chat history)
#     7. Remove storage-data        (contains uploaded files)
#
#   ALLOWED operations (safe):
#     [OK] git fetch / git pull
#     [OK] git clone              (first-time only)
#     [OK] docker compose build   (rebuilds image only)
#     [OK] docker compose up -d   (starts/updates containers)
#     [OK] docker compose restart (restarts running container)
#     [OK] docker compose ps      (read-only status check)
# ====================================================================

# -- Configuration ----------------------------------------------------
$REPO_URL = "https://github.com/ferzat0918/company-agent.git"
$DEFAULT_PROJECT_NAME = "company-agent"

param(
    [string]$ProjectRoot = ""
)

# -- Helpers ----------------------------------------------------------
function Write-Step  { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Skip  { param([string]$msg) Write-Host "  [--] $msg" -ForegroundColor DarkGray }
function Write-Warn  { param([string]$msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$msg) Write-Host "  [XX] $msg" -ForegroundColor Red }

# -- Banner -----------------------------------------------------------
Write-Host ""
Write-Host "  +----------------------------------------------------+" -ForegroundColor Magenta
Write-Host "  |       Company-Agent Smart Deploy                    |" -ForegroundColor Magenta
Write-Host "  +----------------------------------------------------+" -ForegroundColor Magenta
Write-Host "  Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# =====================================================================
#  PHASE 0: Locate or clone the project
# =====================================================================

function Find-ProjectRoot {
    # Strategy 1: Explicit parameter
    if ($script:ProjectRoot -and (Test-Path "$($script:ProjectRoot)\.git")) {
        return $script:ProjectRoot
    }

    # Strategy 2: Script is inside the repo (infra/scripts/)
    if ($PSScriptRoot) {
        $candidate = (Get-Item $PSScriptRoot).Parent.Parent.FullName
        if (Test-Path "$candidate\.git") {
            return $candidate
        }
    }

    # Strategy 3: Check common locations relative to script
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
    $searchPaths = @(
        (Join-Path $scriptDir $DEFAULT_PROJECT_NAME),
        (Join-Path $scriptDir "..\$DEFAULT_PROJECT_NAME"),
        (Join-Path $scriptDir "..\..\$DEFAULT_PROJECT_NAME")
    )
    foreach ($p in $searchPaths) {
        if (Test-Path "$p\.git") {
            return (Resolve-Path $p).Path
        }
    }

    # Not found
    return $null
}

$ProjectRoot = Find-ProjectRoot

if (-not $ProjectRoot) {
    # -- Project not found, need to clone --
    Write-Step "Project not found. Starting first-time setup..."

    # Determine clone location
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
    $defaultCloneDir = Join-Path $scriptDir $DEFAULT_PROJECT_NAME

    Write-Host "  Where should I clone the project?"
    Write-Host "  Default: $defaultCloneDir"
    $customPath = Read-Host "  Press Enter to use default, or type a path"
    
    if ($customPath) {
        $cloneTarget = $customPath
    } else {
        $cloneTarget = $defaultCloneDir
    }

    # Check if target already exists but isn't a git repo
    if (Test-Path $cloneTarget) {
        if (-not (Test-Path "$cloneTarget\.git")) {
            Write-Err "Directory $cloneTarget exists but is not a git repo."
            Write-Err "Please remove it or choose a different path."
            Read-Host "Press Enter to exit"
            exit 1
        }
        # It's a valid git repo
        $ProjectRoot = $cloneTarget
    } else {
        # Clone the repo
        Write-Step "Cloning repository..."
        Write-Host "  From: $REPO_URL"
        Write-Host "  To:   $cloneTarget"
        
        git clone $REPO_URL $cloneTarget 2>&1 | ForEach-Object { Write-Host "  $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Err "git clone failed. Check your network and credentials."
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Ok "Clone complete"
        $ProjectRoot = $cloneTarget
    }
}

Write-Host "  Project: $ProjectRoot"

$InfraDir = Join-Path $ProjectRoot "infra"
$EnvFile  = Join-Path $ProjectRoot ".env"

# =====================================================================
#  PHASE 1: Check .env file
# =====================================================================

if (-not (Test-Path $EnvFile)) {
    $envExample = Join-Path $ProjectRoot ".env.example"
    
    if (Test-Path $envExample) {
        Write-Step ".env file not found. Creating from .env.example..."
        Copy-Item $envExample $EnvFile
        Write-Ok "Created .env from template"
        Write-Host ""
        Write-Host "  +----------------------------------------------------+" -ForegroundColor Yellow
        Write-Host "  |  IMPORTANT: You must edit .env before continuing!   |" -ForegroundColor Yellow
        Write-Host "  |  Fill in your API keys, passwords, and secrets.     |" -ForegroundColor Yellow
        Write-Host "  |                                                     |" -ForegroundColor Yellow
        Write-Host "  |  File: $EnvFile" -ForegroundColor Yellow
        Write-Host "  +----------------------------------------------------+" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  After editing .env, run this script again."
        Read-Host "Press Enter to exit"
        exit 0
    } else {
        Write-Err ".env not found and no .env.example template available."
        Write-Err "Please create .env manually at: $EnvFile"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# =====================================================================
#  PHASE 2: Check if this is a first-time deployment
# =====================================================================

Write-Step "Checking container status..."

Push-Location $InfraDir
$composeCmd = "docker compose --env-file `"$EnvFile`""

# Check if any project containers exist
$existingContainers = docker ps -a --filter "name=company-agent" --filter "name=supabase" --format "{{.Names}}" 2>&1
$containersRunning = docker ps --filter "name=company-agent-langgraph" --filter "status=running" --format "{{.Names}}" 2>&1

if (-not $existingContainers -or $existingContainers.Count -eq 0) {
    # -- First-time deployment: no containers exist at all --
    Write-Warn "No containers found. This appears to be a first-time deployment."
    Write-Host ""
    $confirm = Read-Host "  Build and start all containers? (Y/n)"
    if ($confirm -and $confirm -notmatch "^[Yy]") {
        Write-Warn "Cancelled by user."
        Pop-Location
        exit 0
    }

    Write-Step "Building all containers (this may take a few minutes)..."
    Invoke-Expression "$composeCmd up -d --build"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "All containers started!"
    } else {
        Write-Err "Build failed. Check the output above for errors."
    }

    Write-Step "Container status:"
    Start-Sleep -Seconds 5
    Invoke-Expression "$composeCmd ps --format 'table {{.Name}}\t{{.Status}}'"

    Pop-Location
    Write-Host ""
    Write-Host "  +----------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |       First-time setup complete!                    |" -ForegroundColor Green
    Write-Host "  +----------------------------------------------------+" -ForegroundColor Green
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 0
}

Pop-Location

# =====================================================================
#  PHASE 3: Incremental update (normal flow)
# =====================================================================

Write-Ok "Containers exist. Proceeding with incremental update..."

# -- Fetch latest from origin -----------------------------------------
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

    # -- Check for changes ---------------------------------------------
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
        Write-Host "    - $f" -ForegroundColor DarkYellow
    }

    # -- Pull changes --------------------------------------------------
    Write-Step "Pulling changes..."
    git pull origin main 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git pull failed. You may have local conflicts."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Pull complete"

    # -- Analyze changes -----------------------------------------------
    Write-Step "Analyzing changes..."
    
    $rebuildLanggraph  = $false
    $restartLanggraph  = $false
    $rebuildFrontend   = $false
    $restartFrontend   = $false
    $restartKong       = $false
    $composeReconcile  = $false
    $autoReload        = $false

    foreach ($file in $changedFiles) {
        switch -Wildcard ($file) {
            # -- Langgraph: need full rebuild --
            "backend/pyproject.toml"      { $rebuildLanggraph = $true }
            "infra/Dockerfile.langgraph"  { $rebuildLanggraph = $true }

            # -- Langgraph: bind-mounted .py files, watchfiles auto-reloads --
            "backend/src/*"    { $autoReload = $true }

            # -- Langgraph: prompts/skills are read at startup, not watched --
            "prompts/*"         { $restartLanggraph = $true }
            "skills/*"          { $restartLanggraph = $true }
            "backend/scripts/*" { $restartLanggraph = $true }

            # -- Frontend: static files are bind-mounted --
            "frontend/agent-chat-ui/out/*" { $restartFrontend = $true }

            # -- Frontend: need rebuild --
            "infra/Dockerfile.frontend"    { $rebuildFrontend = $true }

            # -- Infra config changes --
            "infra/docker-compose.yml"     { $composeReconcile = $true }
            "infra/docker-compose.prod.yml" { $composeReconcile = $true }
            "infra/kong.yml"               { $restartKong = $true }
            "infra/nginx.conf"             { $restartFrontend = $true }
        }
    }

    # If rebuilding, no need to separately restart
    if ($rebuildLanggraph) { $restartLanggraph = $false; $autoReload = $false }

    # -- Report plan ---------------------------------------------------
    Write-Step "Deployment plan:"
    
    $hasAction = $false
    
    if ($rebuildLanggraph) {
        Write-Warn "REBUILD langgraph container (dependencies or Dockerfile changed)"
        $hasAction = $true
    }
    if ($restartLanggraph) {
        Write-Warn "RESTART langgraph container (prompts/skills/scripts changed)"
        $hasAction = $true
    }
    if ($autoReload) {
        Write-Ok "Langgraph will AUTO-RELOAD (bind-mounted .py files changed)"
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
        Write-Ok "All changes are in bind-mounted .py files. Langgraph auto-reloads -- no restart needed!"
        Read-Host "Press Enter to exit"
        exit 0
    }

    # -- Confirm -------------------------------------------------------
    Write-Host ""
    $confirm = Read-Host "  Proceed? (Y/n)"
    if ($confirm -and $confirm -notmatch "^[Yy]") {
        Write-Warn "Cancelled by user."
        exit 0
    }

    # -- Execute -------------------------------------------------------
    Push-Location $InfraDir
    try {
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

        # -- Health check ----------------------------------------------
        Write-Step "Checking container status..."
        Start-Sleep -Seconds 3
        Invoke-Expression "$composeCmd ps --format 'table {{.Name}}\t{{.Status}}'"

    } finally {
        Pop-Location
    }

} finally {
    Pop-Location
}

Write-Host ""
Write-Host "  +----------------------------------------------------+" -ForegroundColor Green
Write-Host "  |       Deploy complete!                              |" -ForegroundColor Green
Write-Host "  +----------------------------------------------------+" -ForegroundColor Green
Write-Host "  Finished at $(Get-Date -Format 'HH:mm:ss')"
Write-Host ""
Read-Host "Press Enter to exit"
