#!/usr/bin/env bash
# Update superappsBCI setelah extract tarball (jangan hapus .env)
# Usage: bash deploy/vps-update.sh
set -euo pipefail

APP="/var/www/superappsBCI"
cd "$APP"

echo "==> Folder: $(pwd)"

if [ ! -f package.json ]; then
  echo "ERROR: package.json tidak ada di $APP"
  exit 1
fi

mkdir -p /var/lib/superappsBCI && touch /var/lib/superappsBCI/uptime.pause
trap 'rm -f /var/lib/superappsBCI/uptime.pause' EXIT

echo "==> Perbaiki line endings script..."
sed -i 's/\r$//' deploy/*.sh 2>/dev/null || true

echo "==> Perbaiki .env..."
if [ -f .env ]; then
  grep -q 'dev\.db' .env && sed -i 's|^DATABASE_URL=.*|DATABASE_URL=file:/var/lib/superappsBCI/superappsBCI.db|' .env
  if grep -qE '^(APP_URL=https|https://appsbci)' .env 2>/dev/null || grep -q 'appsbci.com' .env 2>/dev/null; then
    grep -q '^COOKIE_SECURE=' .env && sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' .env || echo "COOKIE_SECURE=true" >> .env
  else
    grep -q '^COOKIE_SECURE=' .env || echo "COOKIE_SECURE=false" >> .env
  fi
else
  echo "ERROR: .env tidak ada — copy dari .env.production.example dulu"
  exit 1
fi

echo "==> Install dependencies..."
npm install

echo "==> Generate Prisma client..."
npx prisma generate

echo "==> Hapus presensi duplikat..."
npm run db:dedupe-attendance || true

echo "==> Database migrate..."
MIGRATE_OK=0
if npx prisma migrate deploy; then
  MIGRATE_OK=1
else
  echo "==> Migrate gagal — recovery migrasi attendance..."
  npm run db:dedupe-attendance || true
  npx prisma migrate resolve --rolled-back 20260901230000_attendance_unique_user_date 2>/dev/null || true
  if npx prisma migrate deploy; then
    MIGRATE_OK=1
  else
    echo "==> Migrate gagal (P3005?) — baseline DB produksi..."
    bash deploy/vps-baseline-migrate.sh
    npx prisma migrate deploy && MIGRATE_OK=1 || true
  fi
fi

if [ "$MIGRATE_OK" -ne 1 ]; then
  echo "ERROR: Database migrate gagal setelah recovery"
  exit 1
fi

npx prisma generate

echo "==> Perbaiki jam presensi hari ini (UTC -> WIB)..."
npm run db:fix-attendance-today || true

echo "==> Hapus jam masuk palsu (ALPHA/IZIN)..."
npm run db:fix-attendance-phantom || true

echo "==> Sync presensi (cuti IZIN + ALPHA)..."
npm run db:sync-attendance || true

echo "==> Libur nasional 2026 + 2027..."
npm run db:seed-holidays || true

echo "==> Import inventaris kantor..."
npm run db:import-inventory || true

echo "==> COA + jurnal otomatis transaksi lama..."
npm run db:accounting-backfill || true

echo "==> Backup database..."
bash deploy/backup-db.sh || true

echo "==> Setup cron (backup + sync)..."
bash deploy/setup-cron.sh || true

echo "==> Build (5-15 menit)..."
export TZ=Asia/Jakarta
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: Build gagal"
  exit 1
fi

echo "==> Restart PM2 (reload .env)..."
chmod 600 .env 2>/dev/null || true
pm2 delete superappsBCI 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save 2>/dev/null || true

sleep 2
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health || echo "000")
echo "==> HTTP /api/health → $HTTP"

if [ "$HTTP" = "200" ]; then
  echo "SUKSES — https://appsbci.com/login"
else
  echo "Build selesai tapi HTTP $HTTP — cek: pm2 logs superappsBCI --lines 30"
fi

pm2 status
