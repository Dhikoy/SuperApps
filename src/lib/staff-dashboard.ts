import { prisma } from "@/lib/prisma";
import { formatJobTitle } from "@/lib/user-profile";
import { getCalendarMonthRange } from "@/lib/period";
import { iterateJakartaDates } from "@/lib/workdays";

const ANNUAL_LEAVE_QUOTA = 12;
const ANNUAL_LEAVE_TYPES = new Set(["Cuti Tahunan", "cuti tahunan"]);

export type AttendanceDay = {
  clockIn: string | null;
  clockOut: string | null;
};

export type StaffProfile = {
  nik: string;
  name: string;
  department: string | null;
  jobTitle: string | null;
  status: string;
};

export type LeaveYearSummary = {
  year: number;
  totalUsed: number;
  remainingAnnual: number;
};

export type StaffViolation = {
  date: string;
  label: string;
};

export type StaffDashboardData = {
  profile: StaffProfile;
  violations: StaffViolation[];
  calendars: {
    year: number;
    month: number;
    days: Record<number, AttendanceDay>;
  }[];
  leaveSummaries: LeaveYearSummary[];
  lateThisMonth: number;
};

function contractStatusLabel(type: string | undefined): string {
  if (type === "PKWTT") return "tetap";
  if (type === "PKWT") return "kontrak";
  if (type === "MAGANG") return "magang";
  return "aktif";
}

function countLeaveDays(start: Date, end: Date): number {
  return iterateJakartaDates(start, end).length;
}

function countApprovedLeaveDays(
  leaves: { leaveType: string; startDate: Date; endDate: Date }[],
  year: number,
  annualOnly = false
): number {
  let total = 0;
  for (const leave of leaves) {
    if (annualOnly && !ANNUAL_LEAVE_TYPES.has(leave.leaveType)) continue;
    for (const day of iterateJakartaDates(leave.startDate, leave.endDate)) {
      const y = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(day)
      );
      if (y === year) total += 1;
    }
  }
  return total;
}

function buildMonthDays(
  attendances: { date: Date; clockInTime: string | null; clockOutTime: string | null }[]
): Record<number, AttendanceDay> {
  const days: Record<number, AttendanceDay> = {};
  for (const att of attendances) {
    const day = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", day: "2-digit" }).format(att.date)
    );
    if (!days[day] || att.clockInTime) {
      days[day] = {
        clockIn: att.clockInTime,
        clockOut: att.clockOutTime,
      };
    }
  }
  return days;
}

function dedupeViolations(
  violations: { date: Date; status: string }[]
): StaffViolation[] {
  const seen = new Set<string>();
  const result: StaffViolation[] = [];
  for (const v of violations) {
    const date = v.date.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
    const key = `${date}:${v.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      date,
      label: v.status === "TERLAMBAT" ? "Terlambat" : "Alpha",
    });
  }
  return result;
}

export async function buildStaffDashboardData(nik: string): Promise<StaffDashboardData> {
  const now = new Date();
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now)
  );
  const currentMonth = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", month: "2-digit" }).format(now)
  );

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const monthRanges = [
    { year: currentYear, month: currentMonth },
    { year: prevYear, month: prevMonth },
  ];

  const rangeStart = getCalendarMonthRange(prevYear, prevMonth).start;
  const rangeEnd = getCalendarMonthRange(currentYear, currentMonth).end;

  const [user, attendances, leaves, violations] = await Promise.all([
    prisma.user.findUnique({
      where: { nik },
      select: {
        nik: true,
        name: true,
        jobTitle: true,
        department: { select: { name: true } },
        contracts: {
          where: { status: "ACTIVE" },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { type: true },
        },
      },
    }),
    prisma.attendance.findMany({
      where: {
        userId: nik,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, clockInTime: true, clockOutTime: true, status: true },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: nik,
        approvalStatus: "APPROVED",
      },
      select: { leaveType: true, startDate: true, endDate: true },
    }),
    prisma.attendance.findMany({
      where: {
        userId: nik,
        status: { in: ["TERLAMBAT", "ALPHA"] },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, status: true },
      orderBy: { date: "desc" },
      take: 8,
    }),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const calendars = monthRanges.map(({ year, month }) => {
    const { start, end } = getCalendarMonthRange(year, month);
    const monthAtt = attendances.filter((a) => a.date >= start && a.date <= end);
    return { year, month, days: buildMonthDays(monthAtt) };
  });

  const leaveSummaries: LeaveYearSummary[] = [currentYear, currentYear - 1].map((year) => {
    const totalUsed = countApprovedLeaveDays(leaves, year);
    const annualUsed = countApprovedLeaveDays(leaves, year, true);
    return {
      year,
      totalUsed,
      remainingAnnual: Math.max(0, ANNUAL_LEAVE_QUOTA - annualUsed),
    };
  });

  return {
    profile: {
      nik: user.nik,
      name: user.name,
      department: user.department?.name ?? null,
      jobTitle: formatJobTitle(user.jobTitle),
      status: contractStatusLabel(user.contracts[0]?.type),
    },
    violations: dedupeViolations(violations),
    calendars,
    leaveSummaries,
    lateThisMonth: (() => {
      const { start, end } = getCalendarMonthRange(currentYear, currentMonth);
      return attendances.filter((a) => a.status === "TERLAMBAT" && a.date >= start && a.date <= end).length;
    })(),
  };
}
