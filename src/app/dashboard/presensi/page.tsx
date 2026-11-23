import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/components/ui";
import { canManagePenalty, hasPermission } from "@/lib/roles";
import { formatCalendarMonthLabel, getCalendarMonthForDate, getCalendarMonthRange } from "@/lib/period";
import { getJakartaTodayEnd } from "@/lib/timezone";
import { dedupeAttendanceRows } from "@/lib/attendance-dedupe";
import { PresensiTable } from "@/components/PresensiTable";
import { PeriodPicker } from "@/components/PeriodPicker";

type Props = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function PresensiPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) return null;
  requirePermission(session.role, "attendance:view");

  const canSeeAll = hasPermission(session.role, "attendance:manage");
  const canClock = hasPermission(session.role, "attendance:clock");
  const defaultPeriod = getCalendarMonthForDate();
  const params = await searchParams;
  const year = parseInt(params.year ?? String(defaultPeriod.year), 10);
  const month = parseInt(params.month ?? String(defaultPeriod.month), 10);
  const { start, end: monthEnd } = getCalendarMonthRange(year, month);
  const todayEnd = getJakartaTodayEnd();
  const end = monthEnd.getTime() > todayEnd.getTime() ? todayEnd : monthEnd;
  const periodLabel = formatCalendarMonthLabel(year, month);

  const attendances = dedupeAttendanceRows(
    await prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(canSeeAll ? {} : { userId: session.id }),
      },
      include: {
        user: { select: { name: true } },
        jamKerja: { select: { shiftName: true, standardClockIn: true } },
      },
      orderBy: { date: "desc" },
    })
  );

  const rows = attendances.map((att) => ({
    id: att.id,
    date: att.date.toISOString(),
    clockInTime: att.clockInTime,
    clockOutTime: att.clockOutTime,
    status: att.status,
    selfieImage: att.selfieImage,
    clockOutSelfieImage: att.clockOutSelfieImage,
    latitude: att.latitude,
    longitude: att.longitude,
    user: att.user,
    jamKerja: att.jamKerja,
  }));

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rekap Presensi</h1>
          <p className="text-slate-500 mt-1">
            {canSeeAll ? "Detail absensi per tanggal" : "Riwayat presensi Anda"}
          </p>
          <p className="text-sm text-[#503200] mt-2 font-medium">{periodLabel}</p>
          <p className="text-xs text-slate-400 mt-1">
            <Link href="/dashboard/presensi/laporan" className="text-[#503200] hover:underline">
              Ringkasan & export → Laporan Presensi
            </Link>
          </p>
          {(canManagePenalty(session.role) || hasPermission(session.role, "attendance:manage")) && (
            <p className="text-xs text-slate-400 mt-1">
              <Link href="/dashboard/presensi/harian" className="text-[#503200] hover:underline">
                Rekap Harian
              </Link>
              {canManagePenalty(session.role) && (
                <>
                  {" · "}
                  <Link href="/dashboard/presensi/penalti" className="text-[#503200] hover:underline">
                    Rekap Penalti
                  </Link>
                </>
              )}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Klik header <strong>Clock In</strong> untuk urut jam terawal (↑) atau terakhir (↓)
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <PeriodPicker year={year} month={month} basePath="/dashboard/presensi" />
          {canClock && (
            <Link href="/dashboard/presensi/clock-in" className="btn-primary">
              Clock In (Selfie + GPS)
            </Link>
          )}
        </div>
      </div>

      <PresensiTable rows={rows} showEmployee={canSeeAll} showLocation />
    </div>
  );
}

