import type { PayrollCalculationMode } from "@/generated/prisma/client";

export type PayrollPolicyConfig = {
  company: string;
  standardWorkDays: number;
  salaryDivisor: number;
  calculationMode: PayrollCalculationMode;
  overtimeWeekday: number | null;
  overtimeHoliday: number | null;
  useNationalHoliday: boolean;
  workDaysPattern: "MON_FRI" | "MON_SUN";
  description: string;
};

/** Kebijakan presensi & payroll BCI Group (dari dokumen internal) */
export const DEFAULT_PAYROLL_POLICIES: PayrollPolicyConfig[] = [
  {
    company: "BCI",
    standardWorkDays: 22,
    salaryDivisor: 173,
    calculationMode: "HOURLY",
    overtimeWeekday: 1.0,
    overtimeHoliday: 2.0,
    useNationalHoliday: true,
    workDaysPattern: "MON_FRI",
    description: "Senin–Jumat, libur nasional. Gaji pokok penuh + lembur (÷173 jam; hari kerja ×1, libur ×2).",
  },
  {
    company: "LBB",
    standardWorkDays: 26,
    salaryDivisor: 26,
    calculationMode: "DAILY",
    overtimeWeekday: null,
    overtimeHoliday: null,
    useNationalHoliday: false,
    workDaysPattern: "MON_SUN",
    description: "Senin–Minggu shifting. Gaji = (pokok ÷ 26) × hari kerja aktual.",
  },
  {
    company: "MKTECH",
    standardWorkDays: 22,
    salaryDivisor: 173,
    calculationMode: "HOURLY",
    overtimeWeekday: 1.0,
    overtimeHoliday: 2.0,
    useNationalHoliday: true,
    workDaysPattern: "MON_FRI",
    description: "Senin–Jumat, libur nasional. Sama seperti BCI (÷173 jam + lembur).",
  },
  {
    company: "MNT",
    standardWorkDays: 22,
    salaryDivisor: 173,
    calculationMode: "HOURLY",
    overtimeWeekday: 1.0,
    overtimeHoliday: 2.0,
    useNationalHoliday: true,
    workDaysPattern: "MON_FRI",
    description: "Senin–Jumat, libur nasional. Gaji pokok penuh + lembur (÷173 jam; hari kerja ×1, libur ×2).",
  },
  {
    company: "DPI",
    standardWorkDays: 22,
    salaryDivisor: 173,
    calculationMode: "HOURLY",
    overtimeWeekday: 1.0,
    overtimeHoliday: 2.0,
    useNationalHoliday: true,
    workDaysPattern: "MON_FRI",
    description: "Senin–Jumat, libur nasional. Gaji pokok penuh + lembur (÷173 jam; hari kerja ×1, libur ×2).",
  },
  {
    company: "PIC",
    standardWorkDays: 22,
    salaryDivisor: 173,
    calculationMode: "HOURLY",
    overtimeWeekday: 1.0,
    overtimeHoliday: 2.0,
    useNationalHoliday: true,
    workDaysPattern: "MON_FRI",
    description: "Konsultan PIC. Senin–Jumat, libur nasional. Gaji pokok penuh + lembur (÷173 jam).",
  },
];

export function policyFromRecord(record: {
  company: string;
  standardWorkDays: number;
  salaryDivisor: number;
  calculationMode: PayrollCalculationMode;
  overtimeWeekday: number | null;
  overtimeHoliday: number | null;
  useNationalHoliday: boolean;
  workDaysPattern: string;
  description: string | null;
}): PayrollPolicyConfig {
  return {
    ...record,
    workDaysPattern: record.workDaysPattern as "MON_FRI" | "MON_SUN",
    description: record.description ?? "",
  };
}

export function getDefaultPolicy(company: string | null | undefined): PayrollPolicyConfig | null {
  if (!company) return null;
  return DEFAULT_PAYROLL_POLICIES.find((p) => p.company === company.toUpperCase()) ?? null;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
