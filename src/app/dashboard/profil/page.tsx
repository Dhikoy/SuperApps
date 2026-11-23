import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { ROLE_LABELS, hasPermission } from "@/lib/roles";
import { formatCalendarMonthLabel, getCalendarMonthForDate, getCalendarMonthRange } from "@/lib/period";
import { getJakartaTodayEnd } from "@/lib/timezone";
import { dedupeAttendanceRows } from "@/lib/attendance-dedupe";
import { MonthPicker } from "./MonthPicker";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ChangeUserIdForm } from "./ChangeUserIdForm";
import { PresensiTable } from "@/components/PresensiTable";
import { SlipGajiProfil } from "@/components/SlipGajiProfil";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";

type Props = {
  searchParams: Promise<{ year?: string; month?: string; changePassword?: string }>;
};

export default async function ProfilPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) return null;

  const profile = await prisma.user.findUnique({
    where: { nik: session.nik },
    select: { nik: true, company: true, jobTitle: true },
  });

  const params = await searchParams;
  const defaultPeriod = getCalendarMonthForDate();
  const year = parseInt(params.year ?? String(defaultPeriod.year), 10);
  const month = parseInt(params.month ?? String(defaultPeriod.month), 10);
  const { start, end: monthEnd } = getCalendarMonthRange(year, month);
  const todayEnd = getJakartaTodayEnd();
  const end = monthEnd.getTime() > todayEnd.getTime() ? todayEnd : monthEnd;
  const periodLabel = formatCalendarMonthLabel(year, month);

  const attendances = dedupeAttendanceRows(
    await prisma.attendance.findMany({
      where: {
        userId: session.id,
        date: { gte: start, lte: end },
      },
      include: {
        jamKerja: { select: { shiftName: true, standardClockIn: true } },
      },
      orderBy: { date: "desc" },
    })
  );

  const totalMasuk = attendances.filter((a) => a.clockInTime != null).length;
  const totalHadir = attendances.filter((a) => a.status === "HADIR").length;
  const totalTerlambat = attendances.filter((a) => a.status === "TERLAMBAT").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil Saya"
        subtitle="Informasi akun dan rekap presensi per bulan kalender"
      />

      {params.changePassword === "required" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anda harus mengganti password default sebelum melanjutkan. Isi form di bawah lalu simpan.
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gradient-brand text-2xl font-bold text-white shadow-lg">
              {session.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 leading-snug break-words">{session.name}</h2>
              <p className="text-sm font-mono text-orange-600">NIK: {session.nik}</p>
              <p className="text-sm font-mono text-slate-500 break-all">@{session.userId}</p>
              {profile?.company && (
                <p className="text-xs text-slate-400">{profile.company} · {profile.jobTitle}</p>
              )}
              <span className="inline-block mt-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                {ROLE_LABELS[session.role]}
              </span>
            </div>
            {hasPermission(session.role, "attendance:clock") && (
              <div className="flex flex-col gap-2 sm:w-44 shrink-0">
                <Link href="/dashboard/presensi/clock-in" className="btn-primary w-full text-center block">
                  Clock In Sekarang
                </Link>
                <Link
                  href="/dashboard/presensi/clock-in"
                  className="btn-secondary w-full text-center block"
                >
                  Clock Out
                </Link>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard title="Total Masuk" value={totalMasuk} accent="blue" />
          <StatCard title="Hadir" value={totalHadir} accent="green" />
          <StatCard title="Terlambat" value={totalTerlambat} accent="orange" />
        </div>
      </div>

      <Card className="p-5 sm:p-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-1">Ganti User ID</h2>
        <p className="text-sm text-slate-500 mb-5">
          Username untuk login — bisa disesuaikan jika nama depan sama (mis. banyak Muhammad)
        </p>
        <ChangeUserIdForm currentUserId={session.userId} />
      </Card>

      <TelegramLinkCard />

      <Card className="p-5 sm:p-6 max-w-xl">
        <h2 className="font-semibold text-slate-900 mb-1">Ganti Password</h2>
        <p className="text-sm text-slate-500 mb-5">Perbarui password akun Anda</p>
        <ChangePasswordForm />
      </Card>

      <Card id="slip-gaji" className="p-5 sm:p-6 scroll-mt-20">
        <h2 className="font-semibold text-slate-900 mb-1">Slip Gaji Saya</h2>
        <p className="text-sm text-slate-500 mb-5">Lihat dan cetak slip gaji per periode cut-off (26—25)</p>
        <SlipGajiProfil />
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Presensi Bulan Ini</h2>
          <p className="text-sm text-slate-500">{periodLabel}</p>
        </div>
        <MonthPicker year={year} month={month} />
      </div>

      <PresensiTable
        rows={attendances.map((att) => ({
          id: att.id,
          date: att.date.toISOString(),
          clockInTime: att.clockInTime,
          clockOutTime: att.clockOutTime,
          status: att.status,
          selfieImage: att.selfieImage,
          clockOutSelfieImage: att.clockOutSelfieImage,
          latitude: att.latitude,
          longitude: att.longitude,
          user: { name: session.name },
          jamKerja: att.jamKerja,
        }))}
        showEmployee={false}
        showLocation={false}
      />
    </div>
  );
}
