#!/usr/bin/env bash
# Setup Nginx + Let's Encrypt HTTPS untuk superappsBCI
#
# Prasyarat:
#   1. DNS A record sudah mengarah ke IP VPS (propagasi 5-60 menit)
#      Contoh: appsbci.com → 31.97.187.110
#   2. PM2 superappsBCI sudah online di port 3000
#   3. Port 80 & 443 terbuka (ufw / firewall Hostinger)
#
# Usage:
#   bash deploy/setup-https.sh appsbci.com admin@appsbci.com
#
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_DIR="/var/www/superappsBCI"
NGINX_SITE="/etc/nginx/sites-available/superappsBCI"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash deploy/setup-https.sh <domain> [email-letsencrypt]"
  echo "Contoh: bash deploy/setup-https.sh appsbci.com admin@appsbci.com"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  EMAIL="admin@${DOMAIN}"
fi

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: $APP_DIR tidak ditemukan"
  exit 1
fi

echo "==> Domain: $DOMAIN"
echo "==> Email Let's Encrypt: $EMAIL"

echo "==> Install nginx + certbot..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt install -y nginx certbot python3-certbot-nginx curl

echo "==> Cek DNS (harus resolve ke IP VPS)..."
RESOLVED=""
if command -v dig >/dev/null 2>&1; then
  RESOLVED=$(dig +short "$DOMAIN" A 2>/dev/null | tail -1 || true)
elif command -v getent >/dev/null 2>&1; then
  RESOLVED=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
fi
SERVER_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || curl -4 -s --max-time 5 icanhazip.com 2>/dev/null || true)
echo "    DNS $DOMAIN → ${RESOLVED:-[tidak ketemu]}"
echo "    IP VPS     → ${SERVER_IP:-[tidak ketemu]}"

if [ -n "$RESOLVED" ] && [ -n "$SERVER_IP" ] && [ "$RESOLVED" != "$SERVER_IP" ]; then
  echo ""
  echo "WARNING: DNS belum mengarah ke VPS ini!"
  echo "Buat A record di panel domain: $DOMAIN → $SERVER_IP"
  read -r -p "Lanjutkan anyway? (y/N) " ans
  if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
    exit 1
  fi
fi

echo "==> Tulis config nginx..."
sed "s/app.domainanda.com/${DOMAIN}/g" "$APP_DIR/deploy/nginx-superappsBCI.conf.example" > "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/superappsBCI

# Jangan timpa default site jika masih dipakai demoquarkus — hapus default hanya jika konflik
if [ -f /etc/nginx/sites-enabled/default ] && grep -q "server_name _" /etc/nginx/sites-enabled/default 2>/dev/null; then
  echo "==> Nonaktifkan nginx default site (hindari konflik port 80)..."
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Firewall port 80/443..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' 2>/dev/null || true
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
fi

echo "==> Minta sertifikat SSL (Let's Encrypt)..."
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect \
  --no-eff-email

echo "==> Update .env aplikasi..."
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"

if grep -q '^COOKIE_SECURE=' "$ENV_FILE"; then
  sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' "$ENV_FILE"
else
  echo "COOKIE_SECURE=true" >> "$ENV_FILE"
fi

if grep -q '^APP_URL=' "$ENV_FILE"; then
  sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" "$ENV_FILE"
else
  echo "APP_URL=https://${DOMAIN}" >> "$ENV_FILE"
fi

# Pastikan DATABASE_URL production
if grep -q 'dev\.db' "$ENV_FILE"; then
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL=file:/var/lib/superappsBCI/superappsBCI.db|' "$ENV_FILE"
fi

echo "==> Restart PM2..."
cd "$APP_DIR"
pm2 restart superappsBCI 2>/dev/null || pm2 start deploy/ecosystem.config.cjs
pm2 save 2>/dev/null || true

echo ""
echo "=========================================="
echo " HTTPS AKTIF"
echo " URL: https://${DOMAIN}"
echo " Login: https://${DOMAIN}/login"
echo "=========================================="
echo ""
echo "Renew otomatis certbot sudah aktif (systemd timer)."
echo "Cek: certbot renew --dry-run"
