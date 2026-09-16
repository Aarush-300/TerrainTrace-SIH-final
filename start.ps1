# ──────────────────────────────────────────────────────────────
#  TerrainTrace - Full-Stack Launcher
#  Starts: Python service (5001) -> Node server (5000) -> Vite client (3000)
#  Press Ctrl+C to stop all services.
# ──────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Track child processes for cleanup
$script:processes = @()

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "   $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "   $msg" -ForegroundColor Red }

# ── Cleanup on exit ──────────────────────────────────────────
function Stop-All {
    Write-Host "`n`n>> Shutting down..." -ForegroundColor Cyan
    foreach ($proc in $script:processes) {
        if ($proc -and -not $proc.HasExited) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Get-CimInstance Win32_Process |
                    Where-Object { $_.ParentProcessId -eq $proc.Id } |
                    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            } catch {}
        }
    }
    Write-Ok "All services stopped."
}

Register-EngineEvent PowerShell.Exiting -Action { Stop-All } | Out-Null

# ── 1. Prerequisite checks ──────────────────────────────────
Write-Step "Checking prerequisites..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js is not installed. Download it from https://nodejs.org"; exit 1
}
Write-Ok "Node.js $(node -v)"

$python = if (Get-Command python -ErrorAction SilentlyContinue) { "python" }
          elseif (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" }
          else { $null }
if (-not $python) {
    Write-Err "Python is not installed. Download it from https://python.org"; exit 1
}
Write-Ok "Python $( & $python --version 2>&1 )"

Write-Step "Checking MongoDB..."
try {
    $mongo = Get-Process mongod -ErrorAction SilentlyContinue
    if ($mongo) {
        Write-Ok "MongoDB is already running (PID $($mongo.Id))."
    } else {
        $mongoCheck = & mongosh --eval "db.runCommand({ping:1})" --quiet 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "MongoDB is reachable."
        } else {
            Write-Warn "MongoDB does not appear to be running."
            Write-Warn "Start it manually or set MONGO_URI in a .env file."
            Write-Warn "Continuing anyway..."
        }
    }
} catch {
    Write-Warn "Could not verify MongoDB. Make sure it is running."
}

# ── 2. Install dependencies ─────────────────────────────────
Write-Step "Installing server dependencies..."
Push-Location "$ROOT\server"
if (-not (Test-Path "node_modules")) { npm install } else { Write-Ok "Already installed." }
Pop-Location

Write-Step "Installing client dependencies..."
Push-Location "$ROOT\client"
if (-not (Test-Path "node_modules")) { npm install } else { Write-Ok "Already installed." }
Pop-Location

Write-Step "Installing Python dependencies..."
Push-Location "$ROOT\python-service"
& $python -m pip install -r requirements.txt --quiet 2>&1 | Out-Null
Write-Ok "Python packages ready."
Pop-Location

# ── 3. Free ports from previous runs ─────────────────────────
Write-Step "Checking for stale processes on ports 3000, 5000, 5001..."
foreach ($port in @(3000, 5000, 5001)) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Warn "Killed stale process on port $port (PID $($conn.OwningProcess))."
        } catch {}
    }
}
Write-Ok "Ports are free."

# ── 4. Start services ───────────────────────────────────────
Write-Step "Starting Python service on http://localhost:5001 ..."
$pyProc = Start-Process -NoNewWindow -PassThru -FilePath $python `
    -ArgumentList "-u app.py" `
    -WorkingDirectory "$ROOT\python-service"
$script:processes += $pyProc

Write-Host "   Waiting for Python service to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5

Write-Step "Starting Node.js server on http://localhost:5000 ..."
$nodeProc = Start-Process -NoNewWindow -PassThru -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory "$ROOT\server"
$script:processes += $nodeProc

Start-Sleep -Seconds 2

Write-Step "Starting Vite dev server on http://localhost:3000 ..."
$viteProc = Start-Process -NoNewWindow -PassThru -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host" `
    -WorkingDirectory "$ROOT\client"
$script:processes += $viteProc

# ── 4. Running ──────────────────────────────────────────────
Write-Host ""
Write-Host "  +----------------------------------------------------+" -ForegroundColor Green
Write-Host "  |   TerrainTrace is running!                          |" -ForegroundColor Green
Write-Host "  |                                                     |" -ForegroundColor Green
Write-Host "  |   App:            http://localhost:3000              |" -ForegroundColor Green
Write-Host "  |   API Server:     http://localhost:5000              |" -ForegroundColor Green
Write-Host "  |   Python Service: http://localhost:5001              |" -ForegroundColor Green
Write-Host "  |                                                     |" -ForegroundColor Green
Write-Host "  |   Press Ctrl+C to stop all services.                |" -ForegroundColor Green
Write-Host "  +----------------------------------------------------+" -ForegroundColor Green
Write-Host ""

try {
    while ($true) {
        foreach ($proc in $script:processes) {
            if ($proc.HasExited) {
                $name = switch ($proc.Id) {
                    $pyProc.Id   { "Python service" }
                    $nodeProc.Id { "Node.js server" }
                    $viteProc.Id { "Vite dev server" }
                    default      { "Process $($proc.Id)" }
                }
                Write-Err "$name exited unexpectedly (code $($proc.ExitCode))."
                Stop-All
                exit 1
            }
        }
        Start-Sleep -Seconds 3
    }
} finally {
    Stop-All
}
