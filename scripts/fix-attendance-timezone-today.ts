/**
 * Perbaiki jam presensi hari ini ke WIB — hanya record absen nyata (ada selfie / clock in).
 * Usage: npm run db:fix-attendance-today
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  minutesToTime,
  resolveAttendanceStatus,
  timeToMinutes,
} from "../src/lib/attendance-time";
import { resolvePresensiForUser, standardClockInFromConfig } from "../src/lib/resolve-presensi";
import { getJakartaClockTime, getJakartaTodayEnd, getJakartaTodayStart } from "../src/lib/timezone";

function utcMidnightForJakartaDay(jakartaStart: Date): Date {
  const y = jakartaStart.getUTCFullYear();
  const m = String(jakartaStart.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jakartaStart.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

function deriveClockOut(correctClockIn: string, oldClockIn: string | null, oldClockOut: string | null) {
  if (!oldClockOut || !oldClockIn) return null;
  const delta = timeToMinutes(oldClockOut) - timeToMinutes(oldClockIn);
  if (delta <= 0) return oldClockOut;
  return minutesToTime(timeToMinutes(correctClockIn) + delta);
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

async function main() {
  const jakartaStart = getJakartaTodayStart();
  const jakartaEnd = getJakartaTodayEnd();
  const utcMidnight = utcMidnightForJakartaDay(jakartaStart);

  const records = await prisma.attendance.findMany({
    where: {
      OR: [
        { date: jakartaStart },
        { date: utcMidnight },
        { createdAt: { gte: jakartaStart, lte: jakartaEnd } },
      ],
    },
    include: {
      user: {
        include: {
          officeLocation: true,
          workSchedule: true,
        },
      },
      jamKerja: true,
    },
  });

  if (records.length === 0) {
    console.log("Tidak ada presensi hari ini.");
    return;
  }

  console.log(`Memproses ${records.length} presensi hari ini (WIB)...\n`);

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

    const sameDate = att.date.getTime() === jakartaStart.getTime();
    const sameIn = att.clockInTime === correctClockIn;
    const sameOut = att.clockOutTime === correctClockOut || (!att.clockOutTime && !correctClockOut);

    if (sameDate && sameIn && sameOut) continue;

    const presensi = await resolvePresensiForUser(att.user);
    const standardClockIn =
      att.jamKerja?.standardClockIn ?? standardClockInFromConfig(presensi.schedule);
    const newStatus = resolveAttendanceStatus(correctClockIn, standardClockIn);

    await prisma.attendance.update({
      where: { id: att.id },
      data: {
        date: jakartaStart,
        clockInTime: correctClockIn,
        clockOutTime: correctClockOut,
        status: newStatus,
      },
    });

    console.log(`- ${att.user.name}: masuk → ${correctClockIn}, status → ${newStatus}`);
    fixed++;
  }

  console.log(`\nSelesai — ${fixed} diperbaiki, ${cleared} jam palsu dihapus.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
