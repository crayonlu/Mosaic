# Format all code files in the Mosaic project
# Runs cargo fmt for Rust code and bun format for TypeScript/JavaScript

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent

Push-Location $ProjectRoot

Write-Host "Formatting Mosaic project files..." -ForegroundColor Cyan

# Format Rust code (server)
Write-Host "`n[1/3] Formatting Rust code (server)..." -ForegroundColor Yellow

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

# Format TypeScript/JavaScript packages via turbo
Write-Host "`n[2/3] Formatting TypeScript packages via turbo..." -ForegroundColor Yellow

bun run format
if ($LASTEXITCODE -eq 0) {
    Write-Host "  turbo format: OK" -ForegroundColor Green
} else {
    Write-Host "  turbo format: FAILED" -ForegroundColor Red
}

# Run CI-equivalent checks (lint, typecheck, format:check)
Write-Host "`n[3/3] Running CI-equivalent checks..." -ForegroundColor Yellow

bun run check
if ($LASTEXITCODE -eq 0) {
    Write-Host "  all checks: OK" -ForegroundColor Green
} else {
    Write-Host "  checks: FAILED" -ForegroundColor Red
}

Pop-Location

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "All formatting and checks complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
