# Deploy fitur Presensi per PT (CompanyPresensiSettings + API + migrate)
# Usage: powershell -ExecutionPolicy Bypass -File deploy/patch-company-presensi.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Vps = "root@31.97.187.110"
$Remote = "/var/www/superappsBCI"

$files = @(
  "src/components/CompanyPresensiSettings.tsx",
  "src/lib/companies.ts",
  "src/lib/presensi-config.ts",
  "src/lib/resolve-presensi.ts",
  "src/app/api/settings/company-presensi/route.ts",
  "src/app/api/me/presensi-config/route.ts",
  "src/app/dashboard/pengaturan/page.tsx",
  "src/app/api/attendance/clock/route.ts",
  "src/app/dashboard/presensi/clock-in/page.tsx",
  "prisma/schema.prisma",
  "prisma/migrations/20260826170000_company_presensi_config/migration.sql"
)

Write-Host "==> Upload file presensi per PT..." -ForegroundColor Cyan
foreach ($f in $files) {
  $local = Join-Path $Root $f
  if (-not (Test-Path $local)) {
    Write-Host "ERROR: tidak ada $local" -ForegroundColor Red
    exit 1
  }
  $remotePath = "$Remote/$($f -replace '\\','/')"
  $remoteDir = Split-Path $remotePath -Parent
  ssh $Vps "mkdir -p $remoteDir"
  scp $local "${Vps}:$remotePath"
}

Write-Host "==> Migrate + rebuild..." -ForegroundColor Cyan
ssh $Vps @"
set -e
cd $Remote
npx prisma migrate deploy
npx prisma generate
export SKIP_TYPECHECK=true
export NODE_OPTIONS='--max-old-space-size=1024'
npm run build
pm2 delete superappsBCI 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
"@

Write-Host ""
Write-Host "SELESAI - login yeni, buka Pengaturan > Presensi per PT" -ForegroundColor Green
