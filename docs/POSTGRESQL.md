# PostgreSQL (opsi produksi)

SuperApps default memakai **SQLite** (`prisma/dev.db`). Untuk produksi skala lebih besar, gunakan PostgreSQL.

## Docker Compose (lokal / staging)

```bash
docker compose -f docker-compose.postgres.yml up -d
```

Set di `.env`:

```env
DATABASE_URL="postgresql://superapps:superapps@localhost:5432/superapps?schema=public"
```

## Migrasi dari SQLite

1. Backup SQLite: `cp prisma/dev.db prisma/dev.db.bak`
2. Set `DATABASE_URL` ke PostgreSQL
3. `npx prisma migrate deploy`
4. `npx prisma db seed` (opsional, hanya dev/staging)

## Produksi VPS

1. Install PostgreSQL 16+ di VPS atau gunakan managed DB
2. Buat user/database khusus aplikasi
3. Set `DATABASE_URL` di `/var/www/superapps/.env`
4. Jalankan `npx prisma migrate deploy` saat deploy (`deploy/vps-update.sh` sudah memanggil migrate)
5. **Jangan** commit `.env` — simpan kredensial di server saja

## Nginx & health check

Endpoint publik: `GET /api/health` — tidak butuh auth, cocok untuk UptimeRobot / cron monitoring.

Rate limit API: lihat `deploy/nginx-superappsBCI.conf.example` (`limit_req_zone`).
