#!/usr/bin/env bash
# Perbaiki database VPS — bypass migrasi rusak, pakai db push + seed
# Jalankan di VPS: bash deploy/vps-fix-db.sh
set -euo pipefail

APP_DIR="/var/www/superappsBCI"
DB_FILE="/var/lib/superappsBCI/superappsBCI.db"
PROD_DB_URL="file:/var/lib/superappsBCI/superappsBCI.db"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env tidak ada di $APP_DIR"
  exit 1
fi

# Perbaiki DATABASE_URL dev.db -> production (support format dengan/tanpa quotes)
if grep -q 'dev\.db' .env; then
  echo "==> Perbaiki DATABASE_URL di .env"
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL=file:/var/lib/superappsBCI/superappsBCI.db|' .env
fi

if ! grep -q '^COOKIE_SECURE=' .env 2>/dev/null; then
  echo "COOKIE_SECURE=false" >> .env
  echo "==> Ditambahkan COOKIE_SECURE=false"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export DATABASE_URL="${DATABASE_URL:-$PROD_DB_URL}"

echo "==> DATABASE_URL=$DATABASE_URL"
echo "==> JWT_SECRET=${JWT_SECRET:+[ada]}${JWT_SECRET:-[KOSONG — isi di .env!]}"

if [ -z "${JWT_SECRET:-}" ]; then
  echo "ERROR: JWT_SECRET wajib di .env"
  exit 1
fi

mkdir -p "$(dirname "$DB_FILE")"

echo "==> Hapus database lama..."
rm -f "$DB_FILE"
rm -f prisma/dev.db

echo "==> Install dependencies..."
npm install

echo "==> Sync schema dari schema.prisma (db push)..."
npx prisma db push --accept-data-loss

echo "==> Generate Prisma client..."
npx prisma generate

echo "==> Seed..."
npm run db:seed

echo "==> Build (SKIP_TYPECHECK=true untuk VPS RAM kecil)..."
export SKIP_TYPECHECK=true
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
npm run build

echo "==> Restart PM2..."
pm2 restart superappsBCI 2>/dev/null || pm2 start deploy/ecosystem.config.cjs
pm2 save 2>/dev/null || true

echo ""
echo "=========================================="
echo " SELESAI"
echo " Login: http://31.97.187.110:3000/login"
echo " User:  yeni"
echo " Pass:  password123"
echo "=========================================="
pm2 status
