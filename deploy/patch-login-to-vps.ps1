# Patch cepat login fix ke VPS (tanpa full tarball)
# Usage: powershell -ExecutionPolicy Bypass -File deploy/patch-login-to-vps.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Vps = "root@31.97.187.110"
$Remote = "/var/www/superappsBCI"

Write-Host "==> Upload file login fix..." -ForegroundColor Cyan
scp "$Root\src\app\login\page.tsx" "${Vps}:${Remote}/src/app/login/page.tsx"
scp "$Root\src\app\api\auth\login\route.ts" "${Vps}:${Remote}/src/app/api/auth/login/route.ts"

Write-Host "==> Rebuild di VPS (5-10 menit)..." -ForegroundColor Cyan
ssh $Vps @"
set -e
cd $Remote
export SKIP_TYPECHECK=true
export NODE_OPTIONS='--max-old-space-size=1024'
npm run build
pm2 delete superappsBCI 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
curl -sS -o /dev/null -w 'HTTP login page: %{http_code}\n' http://127.0.0.1:3000/login
"@

Write-Host ""
Write-Host "SELESAI - buka https://appsbci.com/login (incognito)" -ForegroundColor Green
