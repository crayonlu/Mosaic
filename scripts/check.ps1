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
Write-Host "`n[1/5] Checking Rust (server)..." -ForegroundColor Yellow
if (Test-Path "server/Cargo.toml") {
    Set-Location server
    cargo check
    if ($LASTEXITCODE -ne 0) { $Failed += "server" }
    Set-Location $ProjectRoot
} else {
    Write-Host "  skipped (not found)" -ForegroundColor Gray
}

# Check Rust code (desktop Tauri)
Write-Host "`n[2/5] Checking Rust (desktop Tauri)..." -ForegroundColor Yellow
if (Test-Path "desktop/src-tauri/Cargo.toml") {
    Set-Location desktop/src-tauri
    cargo check
    if ($LASTEXITCODE -ne 0) { $Failed += "desktop/src-tauri" }
    Set-Location $ProjectRoot
} else {
    Write-Host "  skipped (not found)" -ForegroundColor Gray
}

# Check TypeScript packages
Write-Host "`n[3/5] Checking TypeScript packages..." -ForegroundColor Yellow

$packages = @("packages/api", "packages/cache", "packages/utils", "packages/sync")
foreach ($pkg in $packages) {
    if (Test-Path "$pkg/package.json") {
        Write-Host "  Checking $pkg..." -ForegroundColor Gray
        Set-Location $pkg
        bun run lint
        if ($LASTEXITCODE -ne 0) { $Failed += "$pkg (lint)" }
        Set-Location $ProjectRoot
    }
}

# Check desktop
Write-Host "`n[4/5] Checking desktop app..." -ForegroundColor Yellow
if (Test-Path "desktop/package.json") {
    Set-Location desktop
    bun run lint
    if ($LASTEXITCODE -ne 0) { $Failed += "desktop (lint)" }
    Set-Location $ProjectRoot
}

# Check mobile
Write-Host "`n[5/5] Checking mobile app..." -ForegroundColor Yellow
if (Test-Path "mobile/package.json") {
    Set-Location mobile
    bun run lint
    if ($LASTEXITCODE -ne 0) { $Failed += "mobile (lint)" }
    Set-Location $ProjectRoot
}

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
