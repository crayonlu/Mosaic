# Check all code in the Mosaic project (lint + type check)
# Runs cargo clippy + check for Rust, and bun run lint + type check for TypeScript

$ErrorActionPreference = "Stop"

# Get the script directory and find project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item $ScriptDir).Parent.FullName

$Failed = @()

Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan
Write-Host "Checking Mosaic project code..." -ForegroundColor Cyan

# Change to project root
Push-Location $ProjectRoot

# Check Rust code (server)
Write-Host "`n[1/3] Checking Rust (server)..." -ForegroundColor Yellow
if (Test-Path "server/Cargo.toml") {
    Set-Location server
    cargo check
    if ($LASTEXITCODE -ne 0) { $Failed += "server" }
    Set-Location $ProjectRoot
} else {
    Write-Host "  skipped (not found)" -ForegroundColor Gray
}

# Check TypeScript packages via turbo
Write-Host "`n[2/3] Checking TypeScript packages via turbo..." -ForegroundColor Yellow

bun run check
if ($LASTEXITCODE -ne 0) { $Failed += "turbo check" }

# Return to original directory
Pop-Location

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan

if ($Failed.Count -eq 0) {
    Write-Host "All checks passed!" -ForegroundColor Green
} else {
    Write-Host "Check failed for:" -ForegroundColor Red
    foreach ($item in $Failed) {
        Write-Host "  - $item" -ForegroundColor Red
    }
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
