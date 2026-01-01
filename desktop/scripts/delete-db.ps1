$dbPath = Join-Path $env:APPDATA "xyz.cyncyn.mosaic\mosaic.db"

if (Test-Path $dbPath) {
    Remove-Item $dbPath -Force
    Write-Host "Database deleted: $dbPath" -ForegroundColor Green
} else {
    Write-Host "Database file not found: $dbPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Please close the app and restart it. The database will be recreated automatically." -ForegroundColor Cyan

