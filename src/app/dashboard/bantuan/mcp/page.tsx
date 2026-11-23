import { PageHeader, Card } from "@/components/ui";

export default function McpConnectPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Asisten AI (MCP)"
        subtitle="Sudah terpasang di Cursor pada komputer ini. Tidak perlu token."
      />

      <Card className="p-5 sm:p-6 space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          Buka chat Cursor di project SuperApps, lalu tanya langsung. Contoh: keuntungan dan
          pengeluaran setiap perusahaan bulan ini.
        </p>
        <p>Yang bisa ditanyakan:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Keuntungan dan pengeluaran setiap perusahaan</li>
          <li>Presensi hari ini</li>
          <li>Cuti yang menunggu</li>
          <li>Catatan MOM</li>
          <li>Invoice, kwitansi, dan pengajuan dana</li>
          <li>Daftar karyawan</li>
        </ul>
        <p className="text-slate-500">
          Kalau server SuperApps belum muncul di Cursor, tutup lalu buka lagi Cursor sekali.
        </p>
      </Card>
    </div>
  );
}
