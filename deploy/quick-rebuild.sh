#!/usr/bin/env bash
# Rebuild Next.js setelah update komponen UI (tanpa full deploy)
set -euo pipefail
cd /var/www/superappsBCI
rm -rf .next
export SKIP_TYPECHECK=true
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
npm run build
pm2 restart superappsBCI
echo "Selesai — hard refresh browser (Ctrl+Shift+R)"
