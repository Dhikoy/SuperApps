#!/usr/bin/env bash
# Backup SQLite database — jalankan via cron harian
# Contoh cron: 0 2 * * * /var/www/superappsBCI/deploy/backup-db.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/superappsBCI}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
DB_FILE="${DB_FILE:-/var/lib/superappsBCI/superappsBCI.db}"

# Fallback path lokal/dev
if [ ! -f "$DB_FILE" ] && [ -f "$APP_DIR/prisma/dev.db" ]; then
  DB_FILE="$APP_DIR/prisma/dev.db"
fi

KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BACKUP_DIR/superapps_${STAMP}.db"

if [ ! -f "$DB_FILE" ]; then
  echo "Database tidak ditemukan: $DB_FILE"
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  # .backup = snapshot konsisten meski DB sedang dipakai aplikasi
  sqlite3 "$DB_FILE" ".backup '$DEST'"
else
  echo "WARN: sqlite3 tidak ada — pakai cp (kurang aman saat DB aktif)"
  cp "$DB_FILE" "$DEST"
fi

gzip -f "$DEST"

echo "Backup OK: ${DEST}.gz"
find "$BACKUP_DIR" -name "superapps_*.db.gz" -mtime +"$KEEP_DAYS" -delete
echo "Cleanup backup > ${KEEP_DAYS} hari selesai"
