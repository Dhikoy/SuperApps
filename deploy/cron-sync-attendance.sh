#!/usr/bin/env bash
# Cron: sync cuti disetujui → IZIN + tandai ALPHA
set -euo pipefail

APP="${APP_DIR:-/var/www/superappsBCI}"
cd "$APP"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export TZ=Asia/Jakarta

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

npm run db:sync-attendance
