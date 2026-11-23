#!/usr/bin/env bash
# Cek kesehatan deploy superappsBCI di VPS
set -uo pipefail

APP_DIR="/var/www/superappsBCI"
cd "$APP_DIR" 2>/dev/null || { echo "Folder $APP_DIR tidak ada"; exit 1; }

echo "=== ENV ==="
grep -E "^(DATABASE_URL|JWT_SECRET|COOKIE_SECURE|NODE_ENV)=" .env 2>/dev/null || echo ".env tidak ditemukan"

echo ""
echo "=== DATABASE FILE ==="
DB_PATH=$(grep "^DATABASE_URL=" .env 2>/dev/null | sed 's/DATABASE_URL=file://;s/"//g')
if [ -n "$DB_PATH" ] && [ -f "$DB_PATH" ]; then
  echo "OK: $DB_PATH ($(du -h "$DB_PATH" | cut -f1))"
  sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>/dev/null | tr '\n' ' '
  echo ""
  sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM User;" 2>/dev/null | xargs -I{} echo "User count: {}"
else
  echo "MISSING: ${DB_PATH:-?}"
fi

echo ""
echo "=== PM2 ==="
pm2 describe superappsBCI 2>/dev/null | grep -E "status|exec cwd" || pm2 list

echo ""
echo "=== PM2 LOG (10 baris terakhir) ==="
pm2 logs superappsBCI --nostream --lines 10 2>/dev/null || true
