import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { formatPeriodLabel, getPeriodRange } from "@/lib/period";
import { buildPayrollLineItem } from "@/lib/payroll";
import { loadPayrollAdjustmentMap, loadPolicyResolver } from "@/lib/payroll-data";
import { toDateKey } from "@/lib/holidays";
import { writeAuditLog } from "@/lib/audit-log";
import { loadPenaltyPayrollMap } from "@/lib/penalty-store";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const company = searchParams.get("company")?.toUpperCase() ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const { start, end } = getPeriodRange(year, month);
  const periodLabel = formatPeriodLabel(year, month);

  const resolvePolicy = await loadPolicyResolver();
  const adjustmentMap = await loadPayrollAdjustmentMap(year, month);

  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const holidayDates = new Set(holidays.map((h) => toDateKey(h.date)));

  const penaltyMap = await loadPenaltyPayrollMap(year, month);

  const users = await prisma.user.findMany({
    where: {
      ...(company ? { company } : {}),
      ...(userId ? { nik: userId } : {}),
    },
    select: {
      nik: true,
      name: true,
      userId: true,
      company: true,
      attendances: {
        where: { date: { gte: start, lte: end } },
        select: { status: true },
      },
      overtimes: {
        where: {
          date: { gte: start, lte: end },
          approvalStatus: "APPROVED",
        },
        select: { hours: true, type: true },
      },
      salaries: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { gajiPokok: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const items = users.map((u) => {
    return buildPayrollLineItem({
      nik: u.nik,
      name: u.name,
      userId: u.userId,
      company: u.company,
      gajiPokok: u.salaries[0]?.gajiPokok ?? 0,
      attendances: u.attendances,
      overtimes: u.overtimes,
      policyOverride: resolvePolicy(u.company),
      penalty: penaltyMap.get(u.nik) ?? null,
      adjustment: adjustmentMap.get(u.nik) ?? null,
    });
  });

  const viewingOthers = userId ? userId !== session.nik : users.length > 1;
  if (viewingOthers) {
    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: userId ? "VIEW_PAYROLL_USER" : "VIEW_PAYROLL_BULK",
      entity: "Payroll",
      entityId: userId ?? undefined,
      details: `periode ${periodLabel}${company ? ` · ${company}` : ""} · ${users.length} karyawan`,
    });
  }

  return NextResponse.json({
    year,
    month,
    periodLabel,
    holidayCount: holidayDates.size,
    items,
    totals: {
      gajiPeriod: items.reduce((s, i) => s + i.gajiPeriod, 0),
      tunjanganLembur: items.reduce((s, i) => s + i.overtime.tunjanganLembur, 0),
      potonganPenalti: items.reduce((s, i) => s + i.penalty.amount, 0),
      tunjangan: items.reduce((s, i) => s + i.adjustment.allowance, 0),
      uangMakan: items.reduce((s, i) => s + i.adjustment.mealAllowance, 0),
      potonganLain: items.reduce((s, i) => s + i.adjustment.deduction, 0),
      totalGaji: items.reduce((s, i) => s + i.totalGaji, 0),
    },
    penaltyWarnings: items
      .filter((item) => item.penalty.warning)
      .map((item) => `${item.name}: ${item.penalty.warning}`),
  });
}
