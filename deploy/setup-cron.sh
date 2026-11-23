#!/usr/bin/env bash
# Pasang sqlite3 + cron backup harian & sync presensi — jalankan sekali di VPS
set -euo pipefail

APP="${APP_DIR:-/var/www/superappsBCI}"
cd "$APP"

echo "==> Install sqlite3 + cron (untuk backup & jadwal)..."
if ! command -v sqlite3 >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y sqlite3 || {
    echo "WARN: sqlite3 gagal diinstall — backup pakai cp biasa"
  }
fi
if ! command -v crontab >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y cron || {
    echo "WARN: cron gagal diinstall — lewati penjadwalan otomatis"
  }
  service cron start 2>/dev/null || systemctl start cron 2>/dev/null || true
fi

chmod +x deploy/backup-db.sh deploy/cron-sync-attendance.sh deploy/cron-telegram-reminders.sh deploy/cron-uptime.sh deploy/cron-depreciation.sh deploy/cron-pos-sync.sh 2>/dev/null || true

if ! command -v crontab >/dev/null 2>&1; then
  echo "WARN: crontab tidak tersedia — lewati penjadwalan otomatis"
  exit 0
fi

MARKER="# superappsBCI-cron"
TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "deploy/backup-db.sh" | grep -v "cron-sync-attendance.sh" | grep -v "cron-telegram-reminders.sh" | grep -v "cron-uptime.sh" | grep -v "cron-depreciation.sh" | grep -v "cron-pos-sync.sh" > "$TMP" || true

cat >> "$TMP" <<EOF
0 2 * * * cd $APP && bash deploy/backup-db.sh >> /var/log/superapps-backup.log 2>&1 $MARKER
30 1 * * * cd $APP && bash deploy/cron-sync-attendance.sh >> /var/log/superapps-sync.log 2>&1 $MARKER
* * * * * cd $APP && bash deploy/cron-telegram-reminders.sh >> /var/log/superapps-telegram.log 2>&1 $MARKER
* * * * * cd $APP && bash deploy/cron-uptime.sh >> /var/log/superapps-uptime.log 2>&1 $MARKER
0 3 1 * * cd $APP && bash deploy/cron-depreciation.sh >> /var/log/superapps-depreciation.log 2>&1 $MARKER
*/15 * * * * cd $APP && bash deploy/cron-pos-sync.sh >> /var/log/superapps-pos-sync.log 2>&1 $MARKER
EOF

crontab "$TMP"
rm -f "$TMP"

echo "==> Cron terpasang:"
crontab -l | grep "$MARKER" || true
echo "    Backup DB: setiap 02:00 WIB server"
echo "    Sync presensi (ALPHA/IZIN): setiap 01:30 WIB server"
echo "    Telegram reminder: setiap menit (butuh TELEGRAM_BOT_TOKEN + CRON_SECRET di .env)"
echo "    Monitor uptime: setiap menit (alert ke SUPER_ADMIN ber-Telegram / TELEGRAM_ALERT_CHAT_IDS)"
echo "    Penyusutan aset: tanggal 1 jam 03:00 (posting bulan sebelumnya)"
