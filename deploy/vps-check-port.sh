#!/usr/bin/env bash
# App PM2 online tapi port 3000 tidak merespons
set -euo pipefail
cd /var/www/superappsBCI

echo "==> Cek build..."
if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: .next/BUILD_ID tidak ada — perlu rebuild!"
  echo "Jalankan: bash deploy/vps-recover.sh"
  exit 1
fi
echo "    BUILD_ID: $(cat .next/BUILD_ID)"

echo ""
echo "==> Port 3000..."
ss -tlnp | grep 3000 || echo "    TIDAK ADA proses di port 3000"

echo ""
echo "==> PM2 logs (20 baris terakhir)..."
pm2 logs superappsBCI --nostream --lines 20 2>/dev/null || true

echo ""
echo "==> Restart PM2 (fork mode)..."
pm2 delete superappsBCI 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
sleep 4

echo ""
echo "==> Port 3000 setelah restart..."
ss -tlnp | grep 3000 || echo "    MASIH KOSONG — lihat logs di bawah"

echo ""
echo "==> Test login..."
curl -sS -m 5 -X POST "http://127.0.0.1:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"andhika","password":"password123"}' || echo "GAGAL connect"

echo ""
pm2 logs superappsBCI --nostream --lines 15 2>/dev/null || true
