/** Fallback jika tabel Company belum ada / kosong */
export const DEFAULT_COMPANIES = ["BCI", "MKTECH", "MNT", "DPI", "LBB", "PIC"] as const;

export type CompanyCode = string;

export type CompanyRow = {
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  employeeCount?: number;
  createdAt?: string;
  updatedAt?: string;
};
