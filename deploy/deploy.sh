#!/usr/bin/env bash
# Re-deploy superappsBCI di VPS (jalankan dari /var/www/superappsBCI)
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pull latest..."
git pull

echo "==> Install dependencies..."
npm install

echo "==> Migrate database..."
npx prisma migrate deploy

echo "==> Build..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
npm run build

echo "==> Restart PM2..."
pm2 restart superappsBCI || pm2 start deploy/ecosystem.config.cjs

echo "==> Done!"
pm2 status
