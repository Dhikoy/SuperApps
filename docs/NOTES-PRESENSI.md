# Notes — Skema Presensi BCI Group

Dokumen ini merangkum aturan presensi & payroll BCI Group yang diimplementasikan di SuperApps (kantorin).

## Monitoring & deploy

- **Health check:** `GET /api/health` (publik, tanpa auth) — DB ping + timestamp
- **Deploy VPS:** `deploy/vps-update.sh` memverifikasi `/api/health` setelah restart PM2
- **Libur nasional:** `src/lib/holidays.ts` — 2026 + 2027; seed via `npm run db:seed`

---

- **Cut-off:** tanggal **26** bulan sebelumnya s/d **25** bulan berjalan
- Penutupan laporan ke **Departemen Keuangan** setiap tanggal **25**
- Implementasi: `src/lib/period.ts` → `getPeriodRange(year, month)`

Contoh periode Juli 2026: **26 Juni 2026 — 25 Juli 2026**

---

## Kebijakan per Perusahaan

### BCI (mode HOURLY)

| Item | Nilai |
|------|-------|
| Hari kerja | Senin–Jumat |
| Libur | Mengikuti kalender libur nasional Indonesia |
| Hari kerja standar/bulan | 22 hari |
| Pembagi gaji | 173 jam |
| Gaji pokok periode | Penuh (asumsi memenuhi standar kehadiran) |
| Tarif per jam | `Gaji Pokok ÷ 173` |
| Lembur hari kerja | `Tarif × 1.5 × Jam` |
| Lembur hari libur | `Tarif × 2.0 × Jam` |

**Rumus lembur BCI:**
```
Tarif Jam     = Gaji Pokok / 173
Lembur Kerja  = Tarif × 1.5 × Jam Lembur
Lembur Libur  = Tarif × 2.0 × Jam Lembur
Total Gaji    = Gaji Pokok + Σ Lembur (disetujui)
```

### LBB (mode DAILY)

| Item | Nilai |
|------|-------|
| Hari kerja | Senin–Minggu (shifting) |
| Hari kerja standar/bulan | 26 hari |
| Pembagi gaji | 26 hari |
| Gaji periode | `(Gaji Pokok ÷ 26) × Hari Kerja Aktual` |
| Lembur | Tidak berlaku |

**Rumus gaji LBB:**
```
Tarif Harian  = Gaji Pokok / 26
Gaji Periode  = Tarif Harian × Hari Kerja Aktual
Hari Aktual   = HADIR + TERLAMBAT (dalam periode cut-off)
```

---

## Status Presensi

| Status | Dihitung hadir? | Keterangan |
|--------|-----------------|------------|
| HADIR | ✅ Ya | Tepat waktu |
| TERLAMBAT | ✅ Ya | Clock in melewati `standardClockIn` shift |
| IZIN | ❌ Tidak | Dari modul cuti (belum auto-sync) |
| ALPHA | ❌ Tidak | Tidak ada clock in |

---

## Alur Presensi Harian

1. **Clock In** — `/dashboard/presensi/clock-in`
   - Selfie wajib (base64)
   - GPS latitude/longitude
   - Pilih shift kerja (opsional)
   - API: `POST /api/attendance/clock`

2. **Clock Out** — halaman yang sama
   - Wajib sudah clock in hari ini
   - API: `POST /api/attendance/clock-out`

3. **Validasi keterlambatan**
   - Jika `clockInTime > standardClockIn` → status `TERLAMBAT`
   - File: `src/app/api/attendance/clock/route.ts`

---

## Modul Lembur (BCI saja)

1. Karyawan BCI ajukan lembur → `/dashboard/payroll/lembur`
2. API: `POST /api/payroll/overtime`
3. Sistem otomatis deteksi tipe:
   - Tanggal libur nasional → `HOLIDAY` (×2)
   - Selain itu → `WEEKDAY` (×1.5)
4. HRD/Keuangan setujui → `PATCH /api/payroll/overtime/[id]`
5. Hanya lembur `APPROVED` yang masuk perhitungan payroll

---

## Modul Payroll

- Halaman: `/dashboard/payroll`
- API: `GET /api/payroll?year=&month=&company=`
- Akses: role `KEUANGAN`, `HRD`, `SUPER_ADMIN`

**Langkah setup gaji karyawan:**
1. Buka halaman Payroll
2. Form "Set Gaji Pokok" → pilih karyawan + nominal
3. API: `POST /api/payroll/salary`

---

## Struktur Database

| Model | Fungsi |
|-------|--------|
| `PayrollPolicy` | Kebijakan BCI/LBB (divisor, mode, multiplier lembur) |
| `UserSalary` | Gaji pokok per karyawan |
| `PublicHoliday` | Kalender libur nasional |
| `Overtime` | Pengajuan & approval lembur |
| `Attendance` | Presensi harian (+ `clockOutTime`) |
| `WorkSchedule` | Shift/jadwal kerja |

---

## File Implementasi

| File | Deskripsi |
|------|-----------|
| `src/lib/payroll-policy.ts` | Konstanta kebijakan BCI & LBB |
| `src/lib/payroll.ts` | Kalkulasi gaji & lembur |
| `src/lib/holidays.ts` | Data libur nasional 2026 |
| `src/lib/period.ts` | Periode cut-off 26–25 |
| `src/app/api/payroll/route.ts` | Hitung payroll per periode |
| `src/app/api/payroll/overtime/route.ts` | CRUD lembur |
| `src/app/api/attendance/clock-out/route.ts` | Clock out |

---

## Permission (RBAC)

| Permission | Role |
|------------|------|
| `payroll:view` | KEUANGAN, HRD, SUPER_ADMIN |
| `payroll:manage` | KEUANGAN, HRD, SUPER_ADMIN |
| `overtime:submit` | STAFF (BCI), KEUANGAN, HRD |
| `attendance:clock` | STAFF |

---

## Contoh Perhitungan

### BCI — Gaji Rp 5.000.000, lembur 2 jam (hari kerja, disetujui)
```
Tarif jam    = 5.000.000 / 173 = Rp 28.902
Lembur       = 28.902 × 1.5 × 2 = Rp 86.705
Total        = Rp 5.000.000 + Rp 86.705 = Rp 5.086.705
```

### LBB — Gaji Rp 4.000.000, hadir 24 hari
```
Tarif harian = 4.000.000 / 26 = Rp 153.846
Gaji periode = 153.846 × 24 = Rp 3.692.308
```

---

## Yang Belum Diimplementasikan

- Auto-mark ALPHA untuk hari kerja tanpa clock in
- Sync status IZIN dari modul cuti ke presensi
- Potongan gaji karena TERLAMBAT (aturan belum ada di dokumen)
- Export PDF payroll
- Shift assignment per karyawan LBB (shifting per orang)
- Perusahaan MKTECH, MNT, DPI — belum punya kebijakan khusus (fallback: tanpa payroll)

---

## Seed & Migrasi

```bash
npm run db:migrate   # terapkan schema baru
npm run db:seed      # isi policy BCI/LBB, libur nasional, gaji sample
```

Setelah seed:
- Policy BCI & LBB terisi otomatis
- Libur nasional 2026 terisi
- Gaji pokok sample per perusahaan
- Sample lembur BCI (approved)
