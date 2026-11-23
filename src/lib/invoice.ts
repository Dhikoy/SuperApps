/** Tipe dokumen keuangan — spek Detailing Invoice */
export type FinanceDocType = "INVOICE" | "FUND_REQUEST" | "RECEIPT";

/** KOP surat per perusahaan — spek Detailing Invoice */
export const COMPANY_LETTERHEADS: Record<string, string> = {
  BCI: "Brown Cinnamons International",
  ZEN: "ZEN Event Organizers",
  "ZEN EO": "ZEN Event Organizers",
  LBB: "Lha Baguette Bekasi",
  PIC: "Pandawa Integra Consulting",
  MKTECH: "Mumpuni Teknologi Kolaborasi",
  DPI: "Deprezz Power Indonesia",
  AMS: "Arah Makkah Safaran",
  MNT: "MNT",
  YKPN: "YKPN",
};

export const FINANCE_DOC_TYPE_LABELS: Record<FinanceDocType, string> = {
  INVOICE: "Invoice",
  FUND_REQUEST: "Pengajuan Dana",
  RECEIPT: "Kwitansi",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Transfer Bank",
  CASH: "Tunai",
  E_WALLET: "Transfer Dompet Digital",
  ATM: "ATM",
};

const ROMAN_MONTHS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
] as const;

export function romanMonth(monthIndex0: number): string {
  return ROMAN_MONTHS[monthIndex0] ?? "I";
}

export function companyLetterheadName(code: string): string {
  const key = code.trim().toUpperCase();
  return COMPANY_LETTERHEADS[key] ?? COMPANY_LETTERHEADS[code.trim()] ?? code;
}

/**
 * Nomor dokumen:
 * - Invoice: `{seq}/INV/{PT}/{Romawi}/{Tahun}`  contoh 001/INV/BCI/IX/2026
 * - Pengajuan Dana: `{seq}/PD/{PT}/{Romawi}/{Tahun}`
 * - Kwitansi: `{seq}/KEU/{MM}/{Tahun}`  contoh 001/KEU/09/2026
 */
export function formatFinanceDocNumber(opts: {
  docType: FinanceDocType | string;
  company: string;
  issueDate: Date;
  sequence: number;
}): string {
  const seq = String(Math.max(1, opts.sequence)).padStart(3, "0");
  const y = opts.issueDate.getFullYear();
  const m = opts.issueDate.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  const company = opts.company.trim().toUpperCase();

  if (opts.docType === "RECEIPT") {
    return `${seq}/KEU/${mm}/${y}`;
  }
  if (opts.docType === "FUND_REQUEST") {
    return `${seq}/PD/${company}/${romanMonth(m)}/${y}`;
  }
  return `${seq}/INV/${company}/${romanMonth(m)}/${y}`;
}

export const DEFAULT_SIGNATORIES = {
  preparedByName: "Rizka",
  preparedByTitle: "Admin Finance",
  approvedByName: "Handayani",
  approvedByTitle: "Head Of Finance",
} as const;
