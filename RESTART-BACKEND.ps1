# PowerShell script to restart backend server
Write-Host "===== RESTARTING BACKEND SERVER =====" -ForegroundColor Cyan

# Kill existing process on port 5000
try {
    $connection = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
    if ($connection) {
        $pid = $connection.OwningProcess
        Stop-Process -Id $pid -Force
        Write-Host "Killed existing process $pid on port 5000" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "No existing process on port 5000" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Could not check for existing process" -ForegroundColor Yellow
}

# Navigate to server directory
$serverPath = Join-Path $PSScriptRoot "server"
Set-Location $serverPath

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Cyan
Write-Host "Server directory: $serverPath" -ForegroundColor Gray
Write-Host ""

# Start the server
npm run dev
