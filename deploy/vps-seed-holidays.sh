#!/usr/bin/env bash
# Seed libur nasional 2026 + 2027 — jalankan manual di VPS
set -euo pipefail

APP="${APP_DIR:-/var/www/superappsBCI}"
cd "$APP"

if [ ! -f .env ]; then
  echo "ERROR: .env tidak ditemukan di $APP"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export TZ=Asia/Jakarta
echo "==> Seed libur nasional (2026 + 2027)..."
npm run db:seed-holidays
