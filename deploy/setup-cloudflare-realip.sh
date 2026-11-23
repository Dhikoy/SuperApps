#!/usr/bin/env bash
# Nginx di belakang Cloudflare: ambil IP asli pengunjung dari CF-Connecting-IP
# dan teruskan ke app sebagai X-Forwarded-For tunggal (tidak bisa dipalsukan).
# Aman dijalankan ulang; juga aman sebelum DNS dipindah ke Cloudflare.
set -euo pipefail

SITE="${NGINX_SITE:-$(readlink -f /etc/nginx/sites-enabled/superappsBCI)}"
CONF="/etc/nginx/conf.d/cloudflare-realip.conf"
TMP=$(mktemp)

echo "==> Ambil daftar IP Cloudflare..."
{
  echo "# Dibuat oleh deploy/setup-cloudflare-realip.sh — $(date -u +%F)"
  for v in v4 v6; do
    curl -fsS --max-time 15 "https://www.cloudflare.com/ips-$v" | while read -r cidr; do
      [ -n "$cidr" ] && echo "set_real_ip_from $cidr;"
    done
  done
  echo "real_ip_header CF-Connecting-IP;"
} > "$TMP"

if ! grep -q "set_real_ip_from" "$TMP"; then
  echo "ERROR: daftar IP Cloudflare kosong — batal"; rm -f "$TMP"; exit 1
fi

cp "$TMP" "$CONF"
rm -f "$TMP"

if [ -f "$SITE" ]; then
  cp "$SITE" "/root/nginx-superappsBCI.bak-$(date +%Y%m%d%H%M%S)"
  sed -i 's/proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/proxy_set_header X-Forwarded-For $remote_addr;/' "$SITE"
fi

nginx -t
systemctl reload nginx
echo "==> Selesai: $(grep -c set_real_ip_from "$CONF") rentang Cloudflare terpasang"
