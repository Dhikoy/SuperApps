# Backlog — Next Project (setelah Telegram phase 2)

Dokumen ini merangkum fitur yang **belum** dikerjakan di batch saat ini,
supaya bisa dilanjutkan di project berikutnya tanpa kehilangan konteks.

Tanggal: 2026-09-05  
Repo: SuperApps BCI  
Bot: @Appsbci_bot

---

## Sudah selesai (jangan ulang)

### Telegram inti
- Link akun, clock-in/out (lokasi+foto), reminder H-5/telat/pulang
- Approve lembur/cuti/dana, `/status` `/slip` `/pending`
- Ajukan cuti & lembur, digest pagi, `/hariini`, `/menu`
- Notif task, perjalanan dinas approve, dana Paid/Realized
- Stok menipis, aset digital ≤3 hari, onboarding, broadcast HRD, slip PDF

### Telegram phase 2 (batch ini)
1. Koreksi absensi → HRD approve (`/koreksi`, model `AttendanceCorrection`)
2. Izin terlambat cepat (`/izintelat`)
3. Laporan mingguan HR/Super Admin (`/laporan`)
5. Cuti thread atasan → HRD (pesan lanjutan + tombol)
8. `/jadwal`
9. Ajukan perjalanan dinas (`/dinas`)
10. Progress task (`/taskprog`)
11. Notif ulang tahun + kontrak ≤30 hari (HR, ~08:00)
12. Ajukan dana sederhana (`/dana`)
13. Bayar dana + bukti foto (`/bayardana`, field `FundRequest.paymentProof`)
14. Reminder aset digital **H-7** dan **H-1**

---

## Next project — prioritas usulan

### A. Absensi & operasional
| ID | Fitur | Catatan |
|----|--------|---------|
| N1 | Geofence gagal → saran otomatis ajukan dinas | Hook error clock-in |
| N2 | Reminder pending ke approver (10:00 & 15:00) | Cron + `/pending` push |
| N3 | Escalation pending >24 jam → Direksi | Cron + role DIREKSI |
| N4 | QR check-in kantor + konfirmasi bot | Butuh QR web + deep link |

### B. Approval & workflow
| ID | Fitur | Catatan |
|----|--------|---------|
| N5 | Approve bertingkat visual satu chat thread (reply_to_message) | Telegram reply API |
| N6 | UI web daftar koreksi absensi | **DONE** — `/dashboard/hr/koreksi-absensi` |
| N7 | Self-approve guard / audit log koreksi | Sudah partial via reviewedBy |

### C. Karyawan
| ID | Fitur | Catatan |
|----|--------|---------|
| N8 | Voice note → teks untuk cuti/lembur | Speech-to-text service |
| N9 | Multi-bahasa ID/EN | i18n string bot |
| N10 | Notif masa percobaan / KPI review | Mirip kontrak |

### D. Keuangan & eksekutif
| ID | Fitur | Catatan |
|----|--------|---------|
| N11 | `/executive` ringkas Direksi | Omzet/pending/absensi hari ini |
| N12 | Lampiran bukti bayar dikirim ulang sebagai foto ke pengaju | Sekarang teks + path |
| N13 | Realisasi dana via bot | Mirip `/bayardana` |

### E. Platform
| ID | Fitur | Catatan |
|----|--------|---------|
| N14 | SSH key deploy (tanpa password di chat) | Security |
| N15 | Rotate Telegram bot token (sudah pernah expose di chat) | BotFather /revoke |
| N16 | Test suite webhook / flow session | Vitest atau script |

---

## Rekomendasi urutan next project

1. **N2 + N3** — reminder & escalation pending (dampak approval paling besar)  
2. **N6** — halaman web koreksi absensi untuk HRD  
3. **N11** — `/executive` untuk Direksi  
4. **N1** — geofence → saran dinas  
5. Sisanya sesuai prioritas bisnis

---

## File kunci terkait Telegram

- `src/lib/telegram/*` — client, webhook, flows, phase2, reminders  
- `src/app/api/telegram/webhook/route.ts`  
- `src/app/api/cron/telegram-attendance/route.ts`  
- `docs/TELEGRAM-PANDUAN.md`  
- `prisma` — `AttendanceCorrection`, `FundRequest.paymentProof`, `TelegramBotSession`
