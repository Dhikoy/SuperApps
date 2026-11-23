import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function InformationHubPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Information"
        subtitle="Struktur organisasi & catatan Minutes of Meeting"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/information/struktur"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-[#503200]/50 transition-colors shadow-sm"
        >
          <p className="text-base font-semibold text-slate-900">Struktur Role &amp; Koordinasi</p>
          <p className="text-sm text-slate-500 mt-1">
            Dokumen MoM jalur koordinasi per perusahaan
          </p>
        </Link>

        <Link
          href="/dashboard/information/mom"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-[#503200]/50 transition-colors shadow-sm"
        >
          <p className="text-base font-semibold text-slate-900">Tambah / kelola Catatan MOM</p>
          <p className="text-sm text-slate-500 mt-1">
            Form input judul, tanggal, dan isi lengkap
          </p>
        </Link>
      </div>
    </div>
  );
}
