import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolvePresensiForUser } from "@/lib/resolve-presensi";
import { getJakartaTodayStart } from "@/lib/timezone";
import { LiveClock } from "@/components/LiveClock";

export async function TodayAttendanceHero({ nik }: { nik: string }) {
  const today = getJakartaTodayStart();
  const [record, user] = await Promise.all([
    prisma.attendance.findFirst({
      where: { userId: nik, date: today },
      select: {
        clockInTime: true,
        clockOutTime: true,
        status: true,
        jamKerja: { select: { shiftName: true, standardClockIn: true, standardClockOut: true } },
      },
    }),
    prisma.user.findUnique({
      where: { nik },
      select: { company: true, officeLocationId: true, workScheduleId: true, officeLocation: true, workSchedule: true },
    }),
  ]);

  const presensi = user ? await resolvePresensiForUser(user) : null;
  const schedule = record?.jamKerja ?? presensi?.schedule ?? null;

  const state = !record?.clockInTime ? "in" : !record.clockOutTime ? "out" : "done";

  return (
    <div className="overflow-hidden rounded-2xl bg-[#503200] text-white shadow-lg">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <LiveClock className="block font-mono text-4xl font-bold tracking-tight" />
            <LiveClock dateOnly className="mt-0.5 block text-xs text-white/70" />
          </div>
          {schedule && (
            <div className="text-right text-xs text-white/70">
              <p className="font-semibold text-white/90">{schedule.shiftName}</p>
              <p>
                {schedule.standardClockIn} – {schedule.standardClockOut}
              </p>
            </div>
          )}
        </div>

        {state !== "in" && (
          <p className="mt-3 text-sm text-white/80">
            Masuk <span className="font-mono font-semibold text-white">{record?.clockInTime}</span>
            {record?.status === "TERLAMBAT" && <span className="ml-1 text-amber-300">(terlambat)</span>}
            {state === "done" && (
              <>
                {" "}· Pulang <span className="font-mono font-semibold text-white">{record?.clockOutTime}</span>
              </>
            )}
          </p>
        )}
      </div>

      {state === "done" ? (
        <div className="bg-white/10 px-5 py-4 text-center text-sm font-semibold sm:px-6">Presensi hari ini lengkap ✓</div>
      ) : (
        <div className="px-5 pb-5 sm:px-6">
          <Link
            href="/dashboard/presensi/clock-in"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-base font-bold text-[#503200] shadow-sm transition-transform active:scale-[0.98]"
          >
            {state === "in" ? "Clock In Sekarang" : "Clock Out"}
            {state === "out" && schedule && (
              <span className="text-sm font-medium text-[#503200]/70">· jadwal pulang {schedule.standardClockOut}</span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}
