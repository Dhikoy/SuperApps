import { prisma } from "@/lib/prisma";
import { getDefaultPolicy, policyFromRecord, type PayrollPolicyConfig } from "@/lib/payroll-policy";
import { buildPayrollLineItem, type PayrollAdjustmentAmounts } from "@/lib/payroll";
import { getPeriodRange } from "@/lib/period";
import { loadPenaltyPayrollMap } from "@/lib/penalty-store";

export type PolicyResolver = (company: string | null | undefined) => PayrollPolicyConfig | null;

/** Aturan dari tabel PayrollPolicy, jatuh ke DEFAULT_PAYROLL_POLICIES bila belum ada. */
export async function loadPolicyResolver(): Promise<PolicyResolver> {
  const rows = await prisma.payrollPolicy.findMany();
  const map = new Map(rows.map((row) => [row.company.toUpperCase(), policyFromRecord(row)]));
  return (company) => {
    if (!company) return null;
    return map.get(company.toUpperCase()) ?? getDefaultPolicy(company);
  };
}

export async function loadPolicy(company: string | null | undefined) {
  return (await loadPolicyResolver())(company);
}

/** Line item payroll satu karyawan (slip web/Telegram), lengkap dengan denda & penyesuaian. */
export async function loadUserPayrollItem(userNik: string, year: number, month: number) {
  const { start, end } = getPeriodRange(year, month);
  const user = await prisma.user.findUnique({
    where: { nik: userNik },
    select: {
      nik: true,
      name: true,
      userId: true,
      company: true,
      attendances: { where: { date: { gte: start, lte: end } }, select: { status: true } },
      overtimes: {
        where: { date: { gte: start, lte: end }, approvalStatus: "APPROVED" },
        select: { hours: true, type: true },
      },
      salaries: { orderBy: { effectiveFrom: "desc" }, take: 1, select: { gajiPokok: true } },
    },
  });
  if (!user) return null;

  const [policy, adjustmentMap, penaltyMap] = await Promise.all([
    loadPolicy(user.company),
    loadPayrollAdjustmentMap(year, month, [user.nik]),
    loadPenaltyPayrollMap(year, month),
  ]);

  return {
    user,
    item: buildPayrollLineItem({
      nik: user.nik,
      name: user.name,
      userId: user.userId,
      company: user.company,
      gajiPokok: user.salaries[0]?.gajiPokok ?? 0,
      attendances: user.attendances,
      overtimes: user.overtimes,
      policyOverride: policy,
      penalty: penaltyMap.get(user.nik) ?? null,
      adjustment: adjustmentMap.get(user.nik) ?? null,
    }),
  };
}

export async function loadPayrollAdjustmentMap(
  year: number,
  month: number,
  userIds?: string[]
): Promise<Map<string, PayrollAdjustmentAmounts>> {
  const rows = await prisma.payrollAdjustment.findMany({
    where: { year, month, ...(userIds ? { userId: { in: userIds } } : {}) },
  });
  return new Map(
    rows.map((row) => [
      row.userId,
      {
        allowance: row.allowance,
        mealAllowance: row.mealAllowance,
        deduction: row.deduction,
        note: row.note,
      },
    ])
  );
}
