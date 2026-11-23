import Link from "next/link";
import { DailyAttendanceReport } from "@/components/DailyAttendanceReport";

export default function RekapHarianPage() {
  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rekap Harian</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tambah poin penalti dari kolom Penalti. Rupiah dihitung di rekap bulanan.
        </p>
        <Link href="/dashboard/presensi/penalti" className="text-xs font-medium text-[#503200] hover:underline">
          Rekap penalti bulanan
        </Link>
      </div>
      <DailyAttendanceReport />
    </div>
  );
}
