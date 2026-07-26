# Somalia Drought EWS - Systems Startup Script

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Somalia Drought EWS - System Startup" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Setup Backend
Write-Host "[1/2] Setting up Backend..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"

if (-not (Test-Path $backendPath)) {
    Write-Error "Backend directory not found!"
    exit 1
}

Start-Process -NoNewWindow -Wait -FilePath "cmd" -ArgumentList "/c cd `"$backendPath`" && python -m venv venv && venv\Scripts\python -m pip install -r requirements.txt"

# 2. Setup Frontend
Write-Host "[2/2] Setting up Frontend..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "frontend"

if (-not (Test-Path $frontendPath)) {
    Write-Error "Frontend directory not found!"
    exit 1
}

Start-Process -NoNewWindow -Wait -FilePath "cmd" -ArgumentList "/c cd `"$frontendPath`" && npm install"

# 3. Launch Services
Write-Host ""
Write-Host "Launching Services..." -ForegroundColor Green

# Launch Backend in new window
$backendCmd = "cd `"$backendPath`" && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"
Start-Process "cmd" -ArgumentList "/k `"$backendCmd`"" -WindowStyle Normal
Write-Host " - Backend started (Port 8000)"

# Launch Frontend in new window
$frontendCmd = "cd `"$frontendPath`" && npm run dev"
Start-Process "cmd" -ArgumentList "/k `"$frontendCmd`"" -WindowStyle Normal
Write-Host " - Frontend started"

Write-Host ""
Write-Host "System is running!" -ForegroundColor Cyan
Write-Host "Access the application at: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this launcher..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
