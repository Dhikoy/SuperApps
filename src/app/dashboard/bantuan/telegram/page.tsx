import { PageHeader, Card } from "@/components/ui";
import Link from "next/link";

export default function TelegramPanduanPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Tata Cara Telegram"
        subtitle="Website tetap lengkap — bot @Appsbci_bot untuk notifikasi, approval, absensi, cuti, lembur, slip PDF, dan lainnya"
      />

      <Card className="p-5 sm:p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
        <h2 className="text-base font-semibold text-slate-900">1. Hubungkan Telegram per karyawan</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Login{" "}
            <a href="https://appsbci.com/login" className="text-blue-600 font-medium">
              appsbci.com
            </a>{" "}
            →{" "}
            <Link href="/dashboard/profil" className="text-blue-600 font-medium">
              Profil Saya
            </Link>
          </li>
          <li>
            Kartu <strong>Telegram</strong> → <strong>Hubungkan Telegram</strong>
          </li>
          <li>
            Buka{" "}
            <a href="https://t.me/Appsbci_bot" className="text-blue-600 font-medium" target="_blank" rel="noreferrer">
              @Appsbci_bot
            </a>{" "}
            atau kirim <code className="bg-slate-100 px-1 rounded">/start KODE</code>
          </li>
        </ol>
      </Card>

      <Card className="p-5 sm:p-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">2. Perintah & menu</h2>
        <p>
          Ketik <code className="bg-slate-100 px-1 rounded">/menu</code> untuk tombol cepat.
        </p>
        <ul className="space-y-1 list-disc pl-5">
          <li>
            <code className="bg-slate-100 px-1 rounded">/hariini</code> — ringkasan harian
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">/clockin</code> /{" "}
            <code className="bg-slate-100 px-1 rounded">/clockout</code> — absensi lokasi + foto
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">/koreksi</code> — koreksi jam absen (HRD setujui di bot atau{" "}
            <Link href="/dashboard/hr/koreksi-absensi" className="text-blue-600 font-medium">
              HR → Koreksi Absensi
            </Link>
            )
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">/cuti</code> ·{" "}
            <code className="bg-slate-100 px-1 rounded">/lembur</code> — ajukan dari chat
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">/sisacuti</code> ·{" "}
            <code className="bg-slate-100 px-1 rounded">/slip</code> (PDF) ·{" "}
            <code className="bg-slate-100 px-1 rounded">/tasks</code> ·{" "}
            <code className="bg-slate-100 px-1 rounded">/onboarding</code>
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">/pending</code> ·{" "}
            <code className="bg-slate-100 px-1 rounded">/broadcast</code> (HRD)
          </li>
        </ul>
      </Card>

      <Card className="p-5 sm:p-6 space-y-3 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">3. Notifikasi otomatis</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Reminder absensi + digest pagi</li>
          <li>Approve cuti / lembur / dana / perjalanan dinas (tombol)</li>
          <li>Status dana Paid / Realized, task baru, onboarding</li>
          <li>Alert stok menipis & aset digital jatuh tempo</li>
        </ul>
      </Card>

      <Link href="/dashboard/profil" className="btn-primary inline-block text-sm">
        Kembali ke Profil
      </Link>
    </div>
  );
}
