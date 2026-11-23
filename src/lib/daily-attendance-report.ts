import { prisma } from "@/lib/prisma";
import { attendanceScopeUserWhere } from "@/lib/attendance-scope";
import { getJakartaTodayEnd, getJakartaTodayStart } from "@/lib/timezone";
import { iterateJakartaDates } from "@/lib/workdays";

export type DailyReportRow = {
  nik: string;
  userId: string;
  name: string;
  department: string | null;
  company: string | null;
  status: string;
  leaveType: string | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  workHours: string | null;
};

export type DailyReportSummary = {
  hadir: number;
  terlambat: number;
  izin: number;
  alpha: number;
  belumAbsen: number;
  total: number;
};

function isDateInLeave(date: Date, start: Date, end: Date): boolean {
  const day = getJakartaTodayStart(date).getTime();
  for (const d of iterateJakartaDates(start, end)) {
    if (getJakartaTodayStart(d).getTime() === day) return true;
  }
  return false;
}

function formatScanLog(time: string | null): string | null {
  if (!time) return null;
  return time.split(":").length === 2 ? `${time}:00` : time;
}

function formatWorkHours(clockIn: string, clockOut: string): string {
  return `${clockIn} - ${clockOut}`;
}

export async function buildDailyAttendanceReport(
  date: Date,
  options: { userId?: string } = {}
): Promise<{ date: string; rows: DailyReportRow[]; summary: DailyReportSummary }> {
  const dayStart = getJakartaTodayStart(date);
  const dayEnd = getJakartaTodayEnd(date);

  const users = await prisma.user.findMany({
    where: {
      ...attendanceScopeUserWhere(),
      ...(options.userId ? { nik: options.userId } : {}),
    },
    select: {
      nik: true,
      userId: true,
      name: true,
      company: true,
      department: { select: { name: true } },
      workSchedule: { select: { standardClockIn: true, standardClockOut: true } },
    },
    orderBy: { name: "asc" },
  });

  const [attendances, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: dayStart,
        ...(options.userId ? { userId: options.userId } : {}),
      },
      select: {
        userId: true,
        status: true,
        clockInTime: true,
        clockOutTime: true,
        jamKerja: { select: { standardClockIn: true, standardClockOut: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        approvalStatus: "APPROVED",
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
        ...(options.userId ? { userId: options.userId } : {}),
      },
      select: { userId: true, leaveType: true, startDate: true, endDate: true },
    }),
  ]);

  const attendanceByUser = new Map(attendances.map((a) => [a.userId, a]));

  const leaveByUser = new Map<string, string>();
  for (const leave of leaves) {
    if (isDateInLeave(dayStart, leave.startDate, leave.endDate)) {
      leaveByUser.set(leave.userId, leave.leaveType);
    }
  }

  const rows: DailyReportRow[] = users.map((user) => {
    const att = attendanceByUser.get(user.nik);
    const leaveType = leaveByUser.get(user.nik) ?? null;

    if (att) {
      const shift = att.jamKerja ?? user.workSchedule;
      return {
        nik: user.nik,
        userId: user.userId,
        name: user.name,
        department: user.department?.name ?? null,
        company: user.company,
        status: att.status,
        leaveType: att.status === "IZIN" ? leaveType : null,
        clockInTime: formatScanLog(att.clockInTime),
        clockOutTime: att.clockOutTime,
        workHours: shift ? formatWorkHours(shift.standardClockIn, shift.standardClockOut) : null,
      };
    }

    if (leaveType) {
      return {
        nik: user.nik,
        userId: user.userId,
        name: user.name,
        department: user.department?.name ?? null,
        company: user.company,
        status: "IZIN",
        leaveType,
        clockInTime: null,
        clockOutTime: null,
        workHours: null,
      };
    }

    return {
      nik: user.nik,
      userId: user.userId,
      name: user.name,
      department: user.department?.name ?? null,
      company: user.company,
      status: "BELUM_ABSEN",
      leaveType: null,
      clockInTime: null,
      clockOutTime: null,
      workHours: null,
    };
  });

  const summary: DailyReportSummary = {
    hadir: rows.filter((r) => r.status === "HADIR").length,
    terlambat: rows.filter((r) => r.status === "TERLAMBAT").length,
    izin: rows.filter((r) => r.status === "IZIN").length,
    alpha: rows.filter((r) => r.status === "ALPHA").length,
    belumAbsen: rows.filter((r) => r.status === "BELUM_ABSEN").length,
    total: rows.length,
  };

  const dateLabel = dayStart.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  return { date: dateLabel, rows, summary };
}
