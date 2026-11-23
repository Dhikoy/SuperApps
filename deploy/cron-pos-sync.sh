#!/usr/bin/env bash
# Tarik pendapatan harian outlet POS (BMCG, Petik, ...) — dipanggil cron tiap 15 menit
set -euo pipefail
APP="${APP_DIR:-/var/www/superappsBCI}"
cd "$APP"

if ! grep -q '^POS_SYNC_SOURCES=.\+' .env 2>/dev/null; then
  exit 0
fi

SECRET=$(grep '^CRON_SECRET=' .env | head -1 | cut -d= -f2- | sed -E "s/^['\"]//; s/['\"]$//")
if [ -z "$SECRET" ]; then
  echo "$(date -Is) CRON_SECRET kosong — skip"
  exit 0
fi

echo "$(date -Is) $(curl -sS -m 280 -X POST -H "Authorization: Bearer ${SECRET}" "http://127.0.0.1:3000/api/cron/pos-sync?days=3" || true)"
