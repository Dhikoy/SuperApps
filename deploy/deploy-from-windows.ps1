# Deploy superappsBCI ke VPS Hostinger dari Windows
# Usage: powershell -ExecutionPolicy Bypass -File deploy/deploy-from-windows.ps1
# Anda akan diminta password root VPS (2x: upload + deploy)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$VpsHost = "31.97.187.110"
$VpsUser = "root"
$RemoteDir = "/var/www/superappsBCI"
$Tarball = "superappsBCI.tar.gz"

function Convert-ShToLf {
  Get-ChildItem -Path (Join-Path $Root "deploy") -Filter "*.sh" -File | ForEach-Object {
    $text = [System.IO.File]::ReadAllText($_.FullName)
    $text = $text -replace "`r`n", "`n" -replace "`r", "`n"
    [System.IO.File]::WriteAllText($_.FullName, $text)
  }
}

Write-Host "==> Normalisasi line endings script deploy (LF)..." -ForegroundColor Cyan
Convert-ShToLf

Write-Host "==> Buat arsip deploy..." -ForegroundColor Cyan
if (Test-Path $Tarball) { Remove-Item $Tarball -Force }
tar -czf $Tarball `
    --exclude=node_modules `
    --exclude=.next `
    --exclude=dev.db `
    --exclude=prisma/dev.db `
    --exclude=superappsBCI.tar.gz `
    --exclude=.env `
    --exclude=.git `
    .

$size = [math]::Round((Get-Item $Tarball).Length / 1MB, 2)
Write-Host "    $Tarball ($size MB)" -ForegroundColor Green

Write-Host ""
Write-Host "==> Upload ke VPS ($VpsUser@$VpsHost)..." -ForegroundColor Cyan
Write-Host "    (masukkan password root VPS)" -ForegroundColor Yellow
scp $Tarball "${VpsUser}@${VpsHost}:${RemoteDir}/"

Write-Host ""
Write-Host "==> Extract + migrate + build di VPS (5-15 menit)..." -ForegroundColor Cyan
Write-Host "    (masukkan password root VPS lagi)" -ForegroundColor Yellow

# Satu baris perintah — hindari CRLF dari heredoc PowerShell ke bash Linux
$RemoteCmd = 'set -e && cd /var/www/superappsBCI && echo "==> Extract tarball..." && tar -xzf superappsBCI.tar.gz && rm -f superappsBCI.tar.gz && sed -i "s/\r$//" deploy/*.sh 2>/dev/null || true && bash deploy/vps-update.sh'

ssh "${VpsUser}@${VpsHost}" $RemoteCmd
$sshExit = $LASTEXITCODE
if ($sshExit -ne 0) {
    Write-Host ""
    Write-Host "DEPLOY GAGAL (exit $sshExit) - cek output di atas." -ForegroundColor Red
    Write-Host "Manual di VPS:" -ForegroundColor Yellow
    Write-Host "  cd /var/www/superappsBCI && tar -xzf superappsBCI.tar.gz && sed -i 's/\r$//' deploy/*.sh && bash deploy/vps-update.sh" -ForegroundColor Yellow
    exit $sshExit
}

Write-Host ""
Write-Host "DEPLOY SELESAI" -ForegroundColor Green
Write-Host "Buka: https://appsbci.com/login" -ForegroundColor Green
