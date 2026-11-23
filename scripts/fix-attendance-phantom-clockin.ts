/**
 * Bersihkan clockInTime palsu pada record ALPHA/IZIN
 * (akibat script fix timezone yang salah menulis jam dari createdAt).
 *
 * Usage: npm run db:fix-attendance-phantom
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

  let cleared = 0;
  let fixed = 0;

  for (const att of records) {
    if (!isRealClockIn(att)) {
      if (att.clockInTime || att.clockOutTime) {
        await prisma.attendance.update({
          where: { id: att.id },
          data: {
            clockInTime: null,
            clockOutTime: null,
            clockOutSelfieImage: null,
            status: att.status === "IZIN" ? "IZIN" : "ALPHA",
          },
        });
        console.log(`- ${att.user.name}: hapus jam palsu (${att.clockInTime}) — status ${att.status}`);
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
      `- ${att.user.name}: masuk ${att.clockInTime} → ${correctClockIn}, status → ${newStatus}`
    );
    fixed++;
  }

  console.log(`\nSelesai — ${cleared} jam palsu dihapus, ${fixed} record absen nyata diperbaiki.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
