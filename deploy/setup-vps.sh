#!/usr/bin/env bash
# Setup awal VPS untuk superappsBCI
# Jalankan sebagai root: bash deploy/setup-vps.sh

set -euo pipefail

echo "==> Update sistem..."
apt update && apt upgrade -y

echo "==> Install Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

echo "==> Install paket pendukung..."
  apt install -y git nginx certbot python3-certbot-nginx build-essential

echo "==> Install PM2..."
npm install -g pm2

echo "==> Buat folder..."
mkdir -p /var/www/superappsBCI
mkdir -p /var/lib/superappsBCI

if ! id deploy &>/dev/null; then
  echo "==> Buat user deploy..."
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
fi

chown -R deploy:deploy /var/www/superappsBCI /var/lib/superappsBCI

echo "==> Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable || true

echo ""
echo "Selesai! Langkah berikutnya (sebagai user deploy):"
echo "  su - deploy"
echo "  cd /var/www/superappsBCI && git clone <REPO_URL> ."
echo "  cp .env.production.example .env && nano .env"
echo "  npm install && npx prisma migrate deploy && npm run db:seed && npm run build"
echo "  pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup"
echo ""
echo "Lalu setup nginx + SSL — lihat docs/HOSTING-VPS.txt"
