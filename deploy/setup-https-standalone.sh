#!/usr/bin/env bash
# Setup HTTPS appsbci.com — standalone (tidak butuh file deploy lain)
# Usage: bash deploy/setup-https-standalone.sh appsbci.com admin@appsbci.com
set -euo pipefail

DOMAIN="${1:-appsbci.com}"
EMAIL="${2:-admin@appsbci.com}"
APP_DIR="/var/www/superappsBCI"
NGINX_SITE="/etc/nginx/sites-available/superappsBCI"
VPS_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || echo "31.97.187.110")

cd "$APP_DIR"

echo "==> Domain: $DOMAIN"
echo "==> Email: $EMAIL"
echo "==> IP VPS: $VPS_IP"

RESOLVED=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
echo "==> DNS sekarang: ${RESOLVED:-belum resolve} (harus $VPS_IP)"

if [ -n "$RESOLVED" ] && [ "$RESOLVED" != "$VPS_IP" ]; then
  echo ""
  echo "ERROR: DNS masih salah!"
  echo "Di Hostinger → Kelola appsbci.com → DNS → edit A record @ → $VPS_IP"
  echo "Tunggu 10-30 menit, cek: nslookup $DOMAIN"
  exit 1
fi

echo "==> Install nginx + certbot..."
export DEBIAN_FRONTEND=noninteractive
apt update -qq
apt install -y nginx certbot python3-certbot-nginx curl

echo "==> Tulis nginx config..."
cat > "$NGINX_SITE" << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINXEOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/superappsBCI
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl enable nginx
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' 2>/dev/null || true
fi

echo "==> Minta sertifikat SSL..."
certbot --nginx \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect \
  --no-eff-email

echo "==> Update .env..."
ENV_FILE="$APP_DIR/.env"
grep -q '^COOKIE_SECURE=' "$ENV_FILE" && sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' "$ENV_FILE" || echo "COOKIE_SECURE=true" >> "$ENV_FILE"
grep -q '^APP_URL=' "$ENV_FILE" && sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" "$ENV_FILE" || echo "APP_URL=https://${DOMAIN}" >> "$ENV_FILE"

pm2 restart superappsBCI
pm2 save 2>/dev/null || true

echo ""
echo "=========================================="
echo " HTTPS AKTIF"
echo " https://${DOMAIN}/login"
echo "=========================================="
