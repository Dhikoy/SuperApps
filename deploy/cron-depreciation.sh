#!/usr/bin/env bash
# Penyusutan aset bulanan — dipanggil cron tanggal 1 (posting bulan sebelumnya)
set -euo pipefail
APP="${APP_DIR:-/var/www/superappsBCI}"
cd "$APP"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SECRET="${CRON_SECRET:-}"
if [ -z "$SECRET" ]; then
  echo "$(date -Is) CRON_SECRET kosong — skip"
  exit 0
fi

echo "$(date -Is) $(curl -sS -X POST -H "Authorization: Bearer ${SECRET}" http://127.0.0.1:3000/api/cron/depreciation || true)"
