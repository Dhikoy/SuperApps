#!/usr/bin/env bash
# Diagnosa + perbaiki login gagal (DB / PM2 env)
set -euo pipefail

APP="/var/www/superappsBCI"
DB="/var/lib/superappsBCI/superappsBCI.db"
cd "$APP"

echo "==> .env"
grep -E '^(DATABASE_URL|JWT_SECRET|NODE_ENV|COOKIE_SECURE|APP_URL)=' .env | sed 's/JWT_SECRET=.*/JWT_SECRET=[ada]/' || true

set -a
# shellcheck disable=SC1091
source .env
set +a

echo ""
echo "==> Cek file database"
mkdir -p /var/lib/superappsBCI
ls -la "$DB" 2>/dev/null || echo "FILE TIDAK ADA: $DB"

if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB" ]; then
  echo "==> Tabel User:"
  sqlite3 "$DB" "SELECT COUNT(*) AS users FROM User;" 2>/dev/null || echo "ERROR: tabel User tidak ada / DB rusak"
fi

echo ""
echo "==> Test API lokal"
curl -sS -X POST "http://127.0.0.1:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"yeni","password":"password123"}' || true
echo ""

echo ""
echo "==> Reload PM2 dengan .env terbaru..."
pm2 delete superappsBCI 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save 2>/dev/null || true
sleep 2

echo ""
echo "==> Test API setelah reload"
curl -sS -X POST "http://127.0.0.1:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"yeni","password":"password123"}' || true
echo ""

echo ""
echo "Jika masih error, jalankan:"
echo "  bash deploy/vps-baseline-migrate.sh"
echo "  npm run db:seed   # reset data + user demo"
