#!/usr/bin/env bash
# Reminder absensi Telegram — dipanggil cron setiap menit
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
BASE="${APP_BASE_URL:-https://appsbci.com}"

if [ -z "$SECRET" ]; then
  echo "$(date -Is) CRON_SECRET kosong — skip"
  exit 0
fi

curl -sS -X POST -H "Authorization: Bearer ${SECRET}" \
  "${BASE}/api/cron/telegram-attendance" || true
