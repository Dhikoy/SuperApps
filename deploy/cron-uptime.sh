#!/usr/bin/env bash
# Monitor uptime — dipanggil cron setiap menit. Jalan terpisah dari aplikasi Node,
# jadi tetap bisa kirim Telegram walau aplikasi mati.
# Penerima: TELEGRAM_ALERT_CHAT_IDS (pisah koma) atau semua SUPER_ADMIN yang sudah link Telegram.
set -uo pipefail

APP="${APP_DIR:-/var/www/superappsBCI}"
cd "$APP" || exit 0

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
DB_FILE="${DATABASE_URL#file:}"
PUBLIC_URL="${APP_BASE_URL:-https://appsbci.com}"
PUBLIC_URL="${PUBLIC_URL%/}"
STATE_DIR="/var/lib/superappsBCI"
STATE="$STATE_DIR/uptime.state"
FAILS_BEFORE_ALERT=2
FAILS_BEFORE_RESTART=3
DISK_WARN_PCT=90

mkdir -p "$STATE_DIR"

PAUSE="$STATE_DIR/uptime.pause"
if [ -f "$PAUSE" ] && [ -n "$(find "$PAUSE" -mmin -30 2>/dev/null)" ]; then
  exit 0
fi

now=$(date +%s)
status="up"; since="$now"; fails=0; restarted=0; disk_alert_day=""
# shellcheck disable=SC1090
[ -f "$STATE" ] && source "$STATE"

save_state() {
  cat > "$STATE" <<EOF
status=$status
since=$since
fails=$fails
restarted=$restarted
disk_alert_day=$disk_alert_day
EOF
}

recipients() {
  if [ -n "${TELEGRAM_ALERT_CHAT_IDS:-}" ]; then
    echo "$TELEGRAM_ALERT_CHAT_IDS" | tr ',' '\n'
  elif command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB_FILE" ]; then
    sqlite3 "$DB_FILE" "SELECT telegramChatId FROM User WHERE role='SUPER_ADMIN' AND telegramChatId IS NOT NULL;" 2>/dev/null
  fi
}

send() {
  [ -z "$TOKEN" ] && { echo "$(date -Is) TELEGRAM_BOT_TOKEN kosong — $1"; return; }
  local sent=0
  while read -r chat; do
    chat=$(echo "$chat" | tr -d '[:space:]')
    [ -z "$chat" ] && continue
    curl -sS -m 10 -o /dev/null "https://api.telegram.org/bot${TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${chat}" --data-urlencode "text=$1" -d parse_mode=HTML && sent=$((sent + 1))
  done < <(recipients)
  echo "$(date -Is) alert terkirim ke $sent penerima"
}

duration() {
  local s=$1
  if [ "$s" -ge 3600 ]; then printf "%d jam %d menit" $((s / 3600)) $((s % 3600 / 60))
  elif [ "$s" -ge 60 ]; then printf "%d menit" $((s / 60))
  else printf "%d detik" "$s"; fi
}

if [ "${1:-}" = "--test" ]; then
  send "🔔 <b>SuperApps</b>: monitor uptime aktif. Notifikasi down/pulih akan dikirim ke chat ini."
  exit 0
fi

check() {
  curl -s -o /dev/null -m 15 -w "%{http_code}" "$1" 2>/dev/null || echo "000"
}

local_code=$(check "http://127.0.0.1:3000/api/health")
public_code=$(check "$PUBLIC_URL/api/health")
stamp=$(TZ=Asia/Jakarta date "+%d/%m/%Y %H:%M WIB")

if [ "$local_code" = "200" ] && [ "$public_code" = "200" ]; then
  if [ "$status" = "down" ]; then
    send "✅ <b>SuperApps PULIH</b>
${PUBLIC_URL} kembali normal.
Down selama $(duration $((now - since))).
${stamp}"
  fi
  [ "$status" != "up" ] && since="$now"
  status="up"; fails=0; restarted=0
else
  fails=$((fails + 1))
  if [ "$local_code" != "200" ]; then
    reason="Aplikasi tidak merespons (lokal HTTP ${local_code})"
  else
    reason="Aplikasi jalan, tapi akses publik gagal (HTTP ${public_code}) — cek nginx/SSL/DNS"
  fi

  if [ "$local_code" != "200" ] && [ "$fails" -ge "$FAILS_BEFORE_RESTART" ] && [ "$restarted" = "0" ]; then
    pm2 restart superappsBCI >/dev/null 2>&1 && restarted=1
    send "🔄 <b>SuperApps</b>: aplikasi otomatis di-restart (pm2) setelah ${fails} menit gagal."
  fi

  if [ "$status" = "up" ] && [ "$fails" -ge "$FAILS_BEFORE_ALERT" ]; then
    status="down"; since=$((now - (fails - 1) * 60))
    send "🚨 <b>SuperApps DOWN</b>
${reason}
URL: ${PUBLIC_URL}
${stamp}
Restart otomatis dicoba bila belum pulih dalam ${FAILS_BEFORE_RESTART} menit."
  fi
fi

disk_pct=$(df -P / | awk 'NR==2 { gsub("%", "", $5); print $5 }')
today=$(date +%Y-%m-%d)
if [ -n "$disk_pct" ] && [ "$disk_pct" -ge "$DISK_WARN_PCT" ] && [ "$disk_alert_day" != "$today" ]; then
  send "⚠️ <b>SuperApps</b>: disk server terpakai ${disk_pct}%. Bersihkan backup/log lama sebelum penuh."
  disk_alert_day="$today"
fi

save_state
