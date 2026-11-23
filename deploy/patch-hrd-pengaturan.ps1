# Deploy akses Pengaturan untuk HRD
# Usage: powershell -ExecutionPolicy Bypass -File deploy/patch-hrd-pengaturan.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Vps = "root@31.97.187.110"
$Remote = "/var/www/superappsBCI"

$files = @(
  "src/lib/roles.ts",
  "src/app/dashboard/pengaturan/page.tsx",
  "src/app/dashboard/hr/page.tsx",
  "src/app/api/settings/offices/route.ts",
  "src/app/api/settings/offices/[id]/route.ts"
)

Write-Host "==> Upload file HRD pengaturan..." -ForegroundColor Cyan
foreach ($f in $files) {
  $local = Join-Path $Root $f
  $remotePath = "$Remote/$($f -replace '\\','/')"
  scp $local "${Vps}:$remotePath"
}

Write-Host "==> Rebuild..." -ForegroundColor Cyan
ssh $Vps @"
set -e
cd $Remote
export SKIP_TYPECHECK=true
export NODE_OPTIONS='--max-old-space-size=1024'
npm run build
pm2 delete superappsBCI 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
"@

Write-Host ""
Write-Host "SELESAI - login yeni, buka Menu > Pengaturan atau Modul HR > Pengaturan Presensi" -ForegroundColor Green
