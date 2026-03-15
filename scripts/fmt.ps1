# Format all code files in the Mosaic project
# Runs cargo fmt for Rust code and bun format for TypeScript/JavaScript

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent

Push-Location $ProjectRoot

Write-Host "Formatting Mosaic project files..." -ForegroundColor Cyan

# Format Rust code (server + desktop Tauri)
Write-Host "`n[1/4] Formatting Rust code (server + desktop Tauri)..." -ForegroundColor Yellow

# Format server
if (Test-Path "server/Cargo.toml") {
    Set-Location server
    cargo fmt
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  server: OK" -ForegroundColor Green
    } else {
        Write-Host "  server: FAILED" -ForegroundColor Red
    }
    Set-Location $ProjectRoot
} else {
    Write-Host "  server: skipped (not found)" -ForegroundColor Gray
}

# Format desktop Tauri
if (Test-Path "desktop/src-tauri/Cargo.toml") {
    Set-Location desktop/src-tauri
    cargo fmt
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  desktop/src-tauri: OK" -ForegroundColor Green
    } else {
        Write-Host "  desktop/src-tauri: FAILED" -ForegroundColor Red
    }
    Set-Location $ProjectRoot
} else {
    Write-Host "  desktop/src-tauri: skipped (not found)" -ForegroundColor Gray
}

# Format TypeScript/JavaScript packages
Write-Host "`n[2/4] Formatting TypeScript packages..." -ForegroundColor Yellow

$packages = @("packages/api", "packages/cache", "packages/utils")
foreach ($pkg in $packages) {
    if (Test-Path "$pkg/package.json") {
        Write-Host "  Formatting $pkg..." -ForegroundColor Gray
        Set-Location $pkg
        bun format
        Set-Location $ProjectRoot
    }
}

# Format desktop
Write-Host "`n[3/4] Formatting desktop app..." -ForegroundColor Yellow
if (Test-Path "desktop/package.json") {
    Set-Location desktop
    bun format
    Set-Location $ProjectRoot
}

# Format mobile
Write-Host "`n[4/4] Formatting mobile app..." -ForegroundColor Yellow
if (Test-Path "mobile/package.json") {
    Write-Host "  Formatting mobile app..." -ForegroundColor Gray
    Set-Location mobile
    bun format
    Set-Location $ProjectRoot
}

Pop-Location

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "All formatting complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
