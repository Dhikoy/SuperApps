import { formatRupiah } from "@/lib/payroll-policy";

export const PENALTY_MIN = 1;
export const PENALTY_MAX = 100;

/** Karyawan tidak melihat penalti sendiri. Default PRD bagian 12. */
export const EMPLOYEE_CAN_VIEW_OWN_PENALTY = false;

export type PenaltyPayrollState = {
  points: number;
  ratePerPoint: number | null;
  locked: boolean;
};

export type PenaltyPayrollResult = {
  points: number;
  ratePerPoint: number | null;
  amount: number;
  applied: boolean;
  warning: string | null;
  slipLabel: string | null;
};

export function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isPeriodKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function previousPeriod(period: string): string | null {
  if (!isPeriodKey(period)) return null;
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  if (month === 1) return periodKey(year - 1, 12);
  return periodKey(year, month - 1);
}

export function jakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (jakartaDateKey(date) !== dateKey) return null;
  return date;
}

export function isFutureDateKey(dateKey: string, todayKey = jakartaDateKey()) {
  return dateKey > todayKey;
}

export function parsePenaltyPoints(value: unknown): { points: number } | { error: string } {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(n) || n < PENALTY_MIN || n > PENALTY_MAX) {
    return { error: "Poin harus bilangan bulat 1 sampai 100" };
  }
  return { points: n };
}

export function parsePenaltyNote(value: unknown): { note: string } | { error: string } {
  const note = typeof value === "string" ? value.trim() : "";
  if (!note) return { error: "Catatan wajib diisi" };
  return { note };
}

export function parsePenaltyRate(value: unknown): { rate: number } | { error: string } {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n < 0) {
    return { error: "Rate per poin harus angka 0 atau lebih" };
  }
  return { rate: n };
}

export function deductionAmount(points: number, rate: number) {
  return Math.round(points * rate);
}

export function resolvePenaltyDeduction(
  state: PenaltyPayrollState | null | undefined
): PenaltyPayrollResult {
  const points = state?.points ?? 0;
  const rate = state?.ratePerPoint ?? null;
  const locked = Boolean(state?.locked);
  if (points <= 0) {
    return {
      points: 0,
      ratePerPoint: rate,
      amount: 0,
      applied: false,
      warning: null,
      slipLabel: null,
    };
  }
  if (!locked) {
    return {
      points,
      ratePerPoint: rate,
      amount: 0,
      applied: false,
      warning: "Periode penalti belum dikunci. Potongan belum masuk payroll.",
      slipLabel: null,
    };
  }
  if (rate == null) {
    return {
      points,
      ratePerPoint: null,
      amount: 0,
      applied: false,
      warning: "Rate penalti belum ditentukan. Potongan tidak dianggap 0.",
      slipLabel: null,
    };
  }
  const amount = deductionAmount(points, rate);
  return {
    points,
    ratePerPoint: rate,
    amount,
    applied: true,
    warning: null,
    slipLabel: `Potongan Penalti (${points} poin × ${formatRupiah(rate)}) = ${formatRupiah(amount)}`,
  };
}
