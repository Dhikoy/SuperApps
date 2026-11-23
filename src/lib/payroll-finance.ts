import { prisma } from "@/lib/prisma";
import { getPeriodRange } from "@/lib/period";
import { buildPayrollLineItem } from "@/lib/payroll";
import { loadPayrollAdjustmentMap, loadPolicyResolver } from "@/lib/payroll-data";
import { loadPenaltyPayrollMap } from "@/lib/penalty-store";
import { calcBpjsContribution } from "@/lib/bpjs";
import { calcPph21Monthly } from "@/lib/pph21";
import {
  assertAccount,
  EMPTY_PAYROLL_BREAKDOWN,
  payrollNetPay,
  syncPayrollJournal,
  type PayrollBreakdown,
} from "@/lib/accounting/journal";

export async function calculatePayrollTotal(year: number, month: number, company?: string) {
  const { start, end } = getPeriodRange(year, month);

  const users = await prisma.user.findMany({
    where: company && company !== "ALL" ? { company } : {},
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
        where: { date: { gte: start, lte: end }, approvalStatus: "APPROVED" },
        select: { hours: true, type: true },
      },
      salaries: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { gajiPokok: true },
      },
      bpjsEnrollment: true,
      pph21Profile: { select: { ptkpStatus: true } },
    },
  });

  const [penaltyMap, resolvePolicy, adjustmentMap] = await Promise.all([
    loadPenaltyPayrollMap(year, month),
    loadPolicyResolver(),
    loadPayrollAdjustmentMap(year, month),
  ]);
  const rows = users.map((u) => ({
    user: u,
    item: buildPayrollLineItem({
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
    }),
  }));

  const filtered = company && company !== "ALL" ? rows.filter((r) => r.item.company === company) : rows;
  const items = filtered.map((r) => r.item);
  const totalAmount = items.reduce((s, i) => s + i.totalGaji, 0);
  const penaltyWarnings = items
    .filter((item) => item.penalty.warning)
    .map((item) => `${item.name}: ${item.penalty.warning}`);

  const breakdown: PayrollBreakdown = { ...EMPTY_PAYROLL_BREAKDOWN };
  for (const { user, item } of filtered) {
    if (item.calculationMode === "DAILY") breakdown.dailyWage += item.gajiPeriod;
    else breakdown.salary += item.gajiPeriod;
    breakdown.overtime += item.overtime.tunjanganLembur;
    breakdown.penalty += item.penalty.amount;
    breakdown.allowance += item.adjustment.allowance + item.adjustment.mealAllowance;
    breakdown.deduction += item.adjustment.deduction;

    const enrollment = user.bpjsEnrollment;
    if (enrollment && item.gajiPokok > 0) {
      const bpjs = calcBpjsContribution(item.gajiPokok, enrollment);
      if (enrollment.bpjsKes?.trim()) {
        breakdown.bpjsKesEmployer += bpjs.kesEmployer;
        breakdown.bpjsKesEmployee += bpjs.kesEmployee;
      }
      if (enrollment.bpjsTk?.trim()) {
        breakdown.bpjsTkEmployer += bpjs.tkEmployer;
        breakdown.bpjsTkEmployee += bpjs.tkEmployee;
      }
    }

    const gross = item.gajiPeriod + item.overtime.tunjanganLembur + item.adjustment.allowance + item.adjustment.mealAllowance;
    if (user.pph21Profile && gross > 0) {
      breakdown.pph21 += calcPph21Monthly(gross, user.pph21Profile.ptkpStatus).pphBulanan;
    }
  }

  return { items, totalAmount, employeeCount: items.length, penaltyWarnings, breakdown };
}

export async function postPayrollToFinance(
  year: number,
  month: number,
  company: string,
  postedBy: string,
  cashAccountInput?: string | null,
  withholding = false
) {
  const { totalAmount, employeeCount, penaltyWarnings, breakdown } = await calculatePayrollTotal(year, month, company);

  if (totalAmount <= 0) {
    throw new Error("Total payroll 0 — set gaji pokok karyawan terlebih dahulu");
  }

  const conflict = await prisma.payrollPosting.findFirst({
    where: { year, month, ...(company === "ALL" ? { company: { not: "ALL" } } : { company: "ALL" }) },
    select: { company: true },
  });
  if (conflict) {
    throw new Error(
      company === "ALL"
        ? `Periode ini sudah diposting per perusahaan (${conflict.company}) — posting ALL akan menghitung gaji dua kali`
        : "Periode ini sudah diposting untuk ALL — posting per perusahaan akan menghitung gaji dua kali"
    );
  }

  const data = { totalAmount, employeeCount, postedBy, withholding, breakdown: JSON.stringify(breakdown) };
  const posting = await prisma.$transaction(async (tx) => {
    const cashAccount = await assertAccount(tx, cashAccountInput, { label: "Dibayar dari", cash: true });
    const row = await tx.payrollPosting.upsert({
      where: { year_month_company: { year, month, company } },
      create: { year, month, company, cashAccount, ...data },
      update: { ...data, postedAt: new Date(), ...(cashAccount ? { cashAccount } : {}) },
    });
    await syncPayrollJournal(tx, row.id);
    return row;
  });
  return { posting, penaltyWarnings, breakdown, netPay: payrollNetPay(breakdown, withholding) };
}
