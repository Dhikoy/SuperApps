#!/usr/bin/env bash
# Perbaiki migrasi attendance yang gagal di VPS
# Usage: bash deploy/vps-fix-attendance-migrate.sh
set -euo pipefail

APP="/var/www/superappsBCI"
cd "$APP"

echo "==> Fix migrasi attendance_unique_user_date..."

npx prisma generate
npm run db:dedupe-attendance || true

echo "==> Mark failed migration as rolled back..."
npx prisma migrate resolve --rolled-back 20260901230000_attendance_unique_user_date

echo "==> Re-run migrate..."
npx prisma migrate deploy

echo "==> Selesai. Jalankan: bash deploy/vps-update.sh (atau pm2 restart)"
