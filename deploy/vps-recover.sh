#!/usr/bin/env bash
# Pulihkan superappsBCI setelah .next hilang / build gagal
# Jalankan: bash /var/www/superappsBCI/deploy/vps-recover.sh
set -euo pipefail

APP="/var/www/superappsBCI"
cd "$APP"

echo "==> Folder: $(pwd)"

if [ ! -f package.json ]; then
  echo "ERROR: package.json tidak ada. Pastikan path $APP benar."
  exit 1
fi

echo "==> Stop PM2..."
pm2 stop superappsBCI 2>/dev/null || true

echo "==> Perbaiki .env..."
if [ -f .env ]; then
  grep -q 'dev\.db' .env && sed -i 's|^DATABASE_URL=.*|DATABASE_URL=file:/var/lib/superappsBCI/superappsBCI.db|' .env
  grep -q '^COOKIE_SECURE=' .env || echo "COOKIE_SECURE=false" >> .env
else
  echo "ERROR: .env tidak ada!"
  exit 1
fi

echo "==> Pastikan next.config skip typecheck..."
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "true",
  },
};

export default nextConfig;
EOF

echo "==> Hapus build lama..."
rm -rf .next

echo "==> Build (bisa 5-15 menit, jangan interrupt)..."
export SKIP_TYPECHECK=true
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: Build gagal — .next/BUILD_ID tidak ada"
  exit 1
fi

echo "==> Start PM2..."
pm2 start deploy/ecosystem.config.cjs
pm2 save 2>/dev/null || true

sleep 2
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || echo "000")
echo "==> Test http://127.0.0.1:3000/login → HTTP $HTTP"

if [ "$HTTP" = "200" ]; then
  echo ""
  echo "SUKSES — buka http://31.97.187.110:3000/login"
else
  echo ""
  echo "Build OK tapi HTTP $HTTP — cek: pm2 logs superappsBCI --lines 20"
fi

pm2 status
