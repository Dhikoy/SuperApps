/**
 * Perbaiki SEMUA jam presensi ke WIB dari timestamp database (one-time / VPS cleanup).
 * Usage: npm run db:fix-attendance-all
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  minutesToTime,
  resolveAttendanceStatus,
  timeToMinutes,
} from "../src/lib/attendance-time";
import { resolvePresensiForUser, standardClockInFromConfig } from "../src/lib/resolve-presensi";
import { getJakartaClockTime, getJakartaTodayStart } from "../src/lib/timezone";

function deriveClockOut(correctClockIn: string, oldClockIn: string | null, oldClockOut: string | null) {
  if (!oldClockOut || !oldClockIn) return null;
  const delta = timeToMinutes(oldClockOut) - timeToMinutes(oldClockIn);
  if (delta <= 0) return oldClockOut;
  return minutesToTime(timeToMinutes(correctClockIn) + delta);
}

async function main() {
  const records = await prisma.attendance.findMany({
    include: {
      user: {
        include: {
          officeLocation: true,
          workSchedule: true,
        },
      },
      jamKerja: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (records.length === 0) {
    console.log("Tidak ada data presensi.");
    return;
  }

  function isRealClockIn(record: {
    status: string;
    clockInTime: string | null;
    selfieImage: string | null;
    latitude?: number | null;
  }): boolean {
    if (record.status === "ALPHA" || record.status === "IZIN") return false;
    return Boolean(record.selfieImage || record.latitude != null);
  }

  console.log(`Memproses ${records.length} record presensi...\n`);

  let fixed = 0;
  let cleared = 0;

  for (const att of records) {
    if (!isRealClockIn(att)) {
      if (att.clockInTime || att.clockOutTime) {
        await prisma.attendance.update({
          where: { id: att.id },
          data: {
            clockInTime: null,
            clockOutTime: null,
            status: att.status === "IZIN" ? "IZIN" : "ALPHA",
          },
        });
        cleared++;
      }
      continue;
    }

    const correctClockIn = getJakartaClockTime(att.createdAt);
    const correctClockOut = deriveClockOut(correctClockIn, att.clockInTime, att.clockOutTime);
    const correctDate = getJakartaTodayStart(att.createdAt);

    const needsFix =
      att.clockInTime !== correctClockIn ||
      att.clockOutTime !== correctClockOut ||
      att.date.getTime() !== correctDate.getTime();

    if (!needsFix) continue;

    const presensi = await resolvePresensiForUser(att.user);
    const standardClockIn =
      att.jamKerja?.standardClockIn ?? standardClockInFromConfig(presensi.schedule);
    const newStatus = resolveAttendanceStatus(correctClockIn, standardClockIn);

    await prisma.attendance.update({
      where: { id: att.id },
      data: {
        date: correctDate,
        clockInTime: correctClockIn,
        clockOutTime: correctClockOut,
        status: newStatus,
      },
    });

    console.log(
      `- ${att.user.name} (${att.createdAt.toISOString().slice(0, 10)}): ` +
        `masuk ${att.clockInTime} → ${correctClockIn}` +
        (att.clockOutTime ? `, pulang ${att.clockOutTime} → ${correctClockOut}` : "")
    );
    fixed++;
  }

  console.log(`\nSelesai — ${fixed} diperbaiki, ${cleared} jam palsu dihapus.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
