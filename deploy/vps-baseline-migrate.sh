#!/usr/bin/env bash
# Baseline DB produksi yang sudah punya schema tapi belum punya riwayat migrasi Prisma
# Usage: bash deploy/vps-baseline-migrate.sh
set -euo pipefail

cd /var/www/superappsBCI

echo "==> Baseline migrasi yang sudah ada di DB..."

EXISTING=(
  "20260702131910_init"
  "20260702133858_approval_period_supervisor"
  "20260702200000_user_nik_primary_key"
  "20260704120000_payroll_presensi"
  "20260704140000_finance_module"
  "20260818100000_hr_integrations"
)

for m in "${EXISTING[@]}"; do
  echo "    resolve --applied $m"
  npx prisma migrate resolve --applied "$m" || true
done

echo "==> Apply migrasi pending..."
npx prisma migrate deploy

echo "==> Seed konfigurasi presensi (cuti + kantor) jika kosong..."
npx tsx deploy/vps-seed-presensi-config.ts

echo "==> Baseline selesai."
