import type { PayrollCalculationMode, OvertimeType } from "@/generated/prisma/client";
import { getPeriodRange } from "@/lib/period";
import { getDefaultPolicy, type PayrollPolicyConfig } from "@/lib/payroll-policy";
import { isNationalHoliday, toDateKey } from "@/lib/holidays";
import { resolvePenaltyDeduction, type PenaltyPayrollResult, type PenaltyPayrollState } from "@/lib/penalty";

export type AttendanceSummary = {
  totalHadir: number;
  totalTerlambat: number;
  totalMasuk: number;
  hariKerjaAktual: number;
};

export type OvertimeSummary = {
  totalHours: number;
  weekdayHours: number;
  holidayHours: number;
  tunjanganLembur: number;
};

export type PayrollLineItem = {
  nik: string;
  name: string;
  userId: string;
  company: string | null;
  gajiPokok: number;
  policy: PayrollPolicyConfig | null;
  attendance: AttendanceSummary;
  overtime: OvertimeSummary;
  tarifDasar: number;
  gajiPeriod: number;
  penalty: PenaltyPayrollResult;
  adjustment: PayrollAdjustmentAmounts;
  totalGaji: number;
  calculationMode: PayrollCalculationMode | null;
};

export type PayrollAdjustmentAmounts = {
  allowance: number;
  mealAllowance: number;
  deduction: number;
  note: string | null;
};

export const EMPTY_ADJUSTMENT: PayrollAdjustmentAmounts = {
  allowance: 0,
  mealAllowance: 0,
  deduction: 0,
  note: null,
};

export function adjustmentNet(adjustment: PayrollAdjustmentAmounts): number {
  return adjustment.allowance + adjustment.mealAllowance - adjustment.deduction;
}

export function summarizeAttendance(
  records: { status: string }[]
): AttendanceSummary {
  const totalHadir = records.filter((a) => a.status === "HADIR").length;
  const totalTerlambat = records.filter((a) => a.status === "TERLAMBAT").length;
  return {
    totalHadir,
    totalTerlambat,
    totalMasuk: records.length,
    hariKerjaAktual: totalHadir + totalTerlambat,
  };
}

export function calcOvertimePay(
  gajiPokok: number,
  policy: PayrollPolicyConfig,
  entries: { hours: number; type: OvertimeType }[]
): OvertimeSummary {
  const hourlyRate = gajiPokok / policy.salaryDivisor;
  let weekdayHours = 0;
  let holidayHours = 0;
  let tunjanganLembur = 0;

  for (const entry of entries) {
    if (entry.type === "HOLIDAY") {
      holidayHours += entry.hours;
      tunjanganLembur += hourlyRate * (policy.overtimeHoliday ?? 2) * entry.hours;
    } else {
      weekdayHours += entry.hours;
      tunjanganLembur += hourlyRate * (policy.overtimeWeekday ?? 1) * entry.hours;
    }
  }

  return {
    totalHours: weekdayHours + holidayHours,
    weekdayHours,
    holidayHours,
    tunjanganLembur: Math.round(tunjanganLembur),
  };
}

export function calcGajiPeriod(
  gajiPokok: number,
  policy: PayrollPolicyConfig,
  hariKerjaAktual: number
): { tarifDasar: number; gajiPeriod: number } {
  if (policy.calculationMode === "DAILY") {
    const tarifDasar = gajiPokok / policy.salaryDivisor;
    return {
      tarifDasar: Math.round(tarifDasar),
      gajiPeriod: Math.round(tarifDasar * hariKerjaAktual),
    };
  }

  // BCI (HOURLY): gaji pokok penuh per periode + lembur terpisah
  const tarifDasar = gajiPokok / policy.salaryDivisor;
  return {
    tarifDasar: Math.round(tarifDasar),
    gajiPeriod: Math.round(gajiPokok),
  };
}

export function resolveOvertimeType(
  date: Date,
  holidayDates: Set<string>,
  explicit?: OvertimeType
): OvertimeType {
  if (explicit) return explicit;
  return isNationalHoliday(date, holidayDates) ? "HOLIDAY" : "WEEKDAY";
}

export function buildPayrollLineItem(input: {
  nik: string;
  name: string;
  userId: string;
  company: string | null;
  gajiPokok: number;
  attendances: { status: string }[];
  overtimes: { hours: number; type: OvertimeType }[];
  policyOverride?: PayrollPolicyConfig | null;
  penalty?: PenaltyPayrollState | null;
  adjustment?: PayrollAdjustmentAmounts | null;
}): PayrollLineItem {
  const policy = input.policyOverride ?? getDefaultPolicy(input.company);
  const attendance = summarizeAttendance(input.attendances);
  const penalty = resolvePenaltyDeduction(input.penalty);
  const adjustment = input.adjustment ?? EMPTY_ADJUSTMENT;

  if (!policy || input.gajiPokok <= 0) {
    return {
      nik: input.nik,
      name: input.name,
      userId: input.userId,
      company: input.company,
      gajiPokok: input.gajiPokok,
      policy,
      attendance,
      overtime: { totalHours: 0, weekdayHours: 0, holidayHours: 0, tunjanganLembur: 0 },
      tarifDasar: 0,
      gajiPeriod: 0,
      penalty,
      adjustment,
      totalGaji: adjustmentNet(adjustment) - penalty.amount,
      calculationMode: policy?.calculationMode ?? null,
    };
  }

  const { tarifDasar, gajiPeriod } = calcGajiPeriod(
    input.gajiPokok,
    policy,
    attendance.hariKerjaAktual
  );
  const overtime =
    policy.calculationMode === "HOURLY"
      ? calcOvertimePay(input.gajiPokok, policy, input.overtimes)
      : { totalHours: 0, weekdayHours: 0, holidayHours: 0, tunjanganLembur: 0 };

  return {
    nik: input.nik,
    name: input.name,
    userId: input.userId,
    company: input.company,
    gajiPokok: input.gajiPokok,
    policy,
    attendance,
    overtime,
    tarifDasar,
    gajiPeriod,
    penalty,
    adjustment,
    totalGaji: gajiPeriod + overtime.tunjanganLembur + adjustmentNet(adjustment) - penalty.amount,
    calculationMode: policy.calculationMode,
  };
}

export { getPeriodRange, toDateKey };
