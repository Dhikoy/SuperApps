import { prisma } from "@/lib/prisma";
import { attendanceScopeUserWhere } from "@/lib/attendance-scope";
import { getCalendarMonthRange } from "@/lib/period";
import { getDefaultPolicy } from "@/lib/payroll-policy";
import { toDateKey } from "@/lib/holidays";
import { getJakartaTodayStart } from "@/lib/timezone";
import { iterateJakartaDates, isWorkDay } from "@/lib/workdays";

type SyncAlphaOptions = {
  year?: number;
  month?: number;
  userId?: string;
  /** Jangan generate ALPHA untuk hari ini (belum selesai) */
  excludeToday?: boolean;
};

/** Tandai ALPHA untuk hari kerja tanpa absen & tanpa cuti disetujui */
export async function syncAlphaAttendance(options: SyncAlphaOptions = {}) {
  const now = new Date();
  const year = options.year ?? now.getFullYear();
  const month = options.month ?? now.getMonth() + 1;
  const { start, end } = getCalendarMonthRange(year, month);

  const todayStart = getJakartaTodayStart(now);
  const cutoffEnd =
    options.excludeToday !== false && end.getTime() > todayStart.getTime()
      ? new Date(todayStart.getTime() - 1)
      : end;

  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: cutoffEnd } },
  });
  const holidayDates = new Set(holidays.map((h) => toDateKey(h.date)));

  const dbPolicies = await prisma.payrollPolicy.findMany();
  const policyMap = new Map(dbPolicies.map((p) => [p.company, p]));

  const users = await prisma.user.findMany({
    where: {
      ...attendanceScopeUserWhere(),
      ...(options.userId ? { nik: options.userId } : {}),
    },
    select: { nik: true, company: true, joinDate: true },
  });

  let created = 0;

  for (const user of users) {
    const dbPolicy = user.company ? policyMap.get(user.company) : null;
    const defaultPolicy = user.company ? getDefaultPolicy(user.company) : null;
    const pattern = (dbPolicy?.workDaysPattern ??
      defaultPolicy?.workDaysPattern ??
      "MON_FRI") as "MON_FRI" | "MON_SUN";

    const [attendances, approvedLeaves] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId: user.nik, date: { gte: start, lte: cutoffEnd } },
        select: {
          id: true,
          date: true,
          status: true,
          clockInTime: true,
          clockOutTime: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          userId: user.nik,
          approvalStatus: "APPROVED",
          startDate: { lte: cutoffEnd },
          endDate: { gte: start },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);

    const leaveDays = new Set<number>();
    for (const leave of approvedLeaves) {
      for (const d of iterateJakartaDates(leave.startDate, leave.endDate)) {
        leaveDays.add(getJakartaTodayStart(d).getTime());
      }
    }

    const joinDayKey = user.joinDate
      ? getJakartaTodayStart(user.joinDate).getTime()
      : null;
    const invalidAlphaIds = attendances
      .filter((attendance) => {
        if (
          attendance.status !== "ALPHA" ||
          attendance.clockInTime ||
          attendance.clockOutTime
        ) {
          return false;
        }
        const dayKey = getJakartaTodayStart(attendance.date).getTime();
        const beforeJoin = joinDayKey !== null && dayKey < joinDayKey;
        return (
          beforeJoin ||
          leaveDays.has(dayKey) ||
          !isWorkDay(attendance.date, pattern, holidayDates)
        );
      })
      .map((attendance) => attendance.id);
    if (invalidAlphaIds.length > 0) {
      await prisma.attendance.deleteMany({ where: { id: { in: invalidAlphaIds } } });
    }
    const invalidAlphaSet = new Set(invalidAlphaIds);
    const attendedDays = new Set(
      attendances
        .filter((attendance) => !invalidAlphaSet.has(attendance.id))
        .map((attendance) => getJakartaTodayStart(attendance.date).getTime())
    );

    for (const day of iterateJakartaDates(start, cutoffEnd)) {
      const dayKey = getJakartaTodayStart(day).getTime();
      if (user.joinDate && dayKey < getJakartaTodayStart(user.joinDate).getTime()) continue;
      if (!isWorkDay(day, pattern, holidayDates)) continue;
      if (attendedDays.has(dayKey)) continue;
      if (leaveDays.has(dayKey)) continue;

      const existing = await prisma.attendance.findFirst({
        where: { userId: user.nik, date: day },
      });
      if (existing) continue;

      await prisma.attendance.create({
        data: {
          userId: user.nik,
          date: day,
          status: "ALPHA",
        },
      });
      created++;
      attendedDays.add(dayKey);
    }
  }

  return { year, month, created };
}
