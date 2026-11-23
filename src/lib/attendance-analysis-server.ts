import { prisma } from "@/lib/prisma";
import { attendanceScopeUserWhere } from "@/lib/attendance-scope";
import {
  analyzeAttendancePeriod,
  summarizeAttendanceAnalysis,
} from "@/lib/attendance-analysis";
import { getDefaultPolicy } from "@/lib/payroll-policy";
import { getCalendarMonthRange, formatCalendarMonthLabel } from "@/lib/period";
import { getJakartaTodayEnd } from "@/lib/timezone";
import { toDateKey } from "@/lib/holidays";

export async function getAttendanceAnalysis(input: {
  year: number;
  month: number;
  company?: string;
}) {
  const { start, end: monthEnd } = getCalendarMonthRange(input.year, input.month);
  const todayEnd = getJakartaTodayEnd();
  const end = monthEnd.getTime() > todayEnd.getTime() ? todayEnd : monthEnd;
  const period = `${input.year}-${String(input.month).padStart(2, "0")}`;

  const [holidays, policies, employees, reviews] = await Promise.all([
    prisma.publicHoliday.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true },
    }),
    prisma.payrollPolicy.findMany({
      select: { company: true, workDaysPattern: true },
    }),
    prisma.user.findMany({
      where: {
        ...attendanceScopeUserWhere(),
        ...(input.company ? { company: input.company } : {}),
      },
      select: {
        nik: true,
        name: true,
        userId: true,
        company: true,
        joinDate: true,
        attendances: {
          where: { date: { gte: start, lte: end } },
          select: {
            date: true,
            status: true,
            clockInTime: true,
            clockOutTime: true,
            selfieImage: true,
            clockOutSelfieImage: true,
          },
        },
        leaveRequests: {
          where: {
            approvalStatus: "APPROVED",
            startDate: { lte: end },
            endDate: { gte: start },
          },
          select: { startDate: true, endDate: true },
        },
        exitRequests: {
          where: { status: { in: ["APPROVED", "CLEARANCE", "COMPLETED"] } },
          orderBy: { resignDate: "desc" },
          take: 1,
          select: { resignDate: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceIssueReview.findMany({
      where: { period },
    }),
  ]);

  const policyMap = new Map(policies.map((policy) => [policy.company, policy.workDaysPattern]));
  const rows = analyzeAttendancePeriod(
    employees.map((employee) => {
      const defaultPattern = employee.company
        ? getDefaultPolicy(employee.company)?.workDaysPattern
        : undefined;
      const workDaysPattern =
        policyMap.get(employee.company ?? "") ?? defaultPattern ?? "MON_FRI";
      return {
        ...employee,
        approvedLeaves: employee.leaveRequests,
        employmentEndDate: employee.exitRequests[0]?.resignDate ?? null,
        workDaysPattern: workDaysPattern as "MON_FRI" | "MON_SUN",
      };
    }),
    { start, end },
    new Set(holidays.map((holiday) => toDateKey(holiday.date)))
  );
  const reviewMap = new Map(reviews.map((review) => [review.userId, review]));

  return {
    year: input.year,
    month: input.month,
    period,
    periodLabel: formatCalendarMonthLabel(input.year, input.month),
    summary: summarizeAttendanceAnalysis(rows),
    rows: rows.map((row) => ({
      ...row,
      review: reviewMap.get(row.nik) ?? null,
    })),
  };
}
