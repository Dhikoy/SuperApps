export type AccountGroupKey = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type JournalSourceKey =
  | "MANUAL"
  | "OPENING"
  | "FUND_PAYMENT"
  | "FUND_REALIZATION"
  | "INCOME"
  | "POS_EXPENSE"
  | "PAYROLL"
  | "INVOICE"
  | "DEPRECIATION";

export const ACCOUNT_GROUP_LABELS: Record<AccountGroupKey, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

export const JOURNAL_SOURCE_LABELS: Record<JournalSourceKey, string> = {
  MANUAL: "Jurnal Umum",
  OPENING: "Saldo Awal",
  FUND_PAYMENT: "Pembayaran Pengajuan",
  FUND_REALIZATION: "Realisasi Pengajuan",
  INCOME: "Pendapatan",
  POS_EXPENSE: "Pengeluaran POS",
  PAYROLL: "Payroll",
  INVOICE: "Piutang Invoice",
  DEPRECIATION: "Penyusutan",
};

/** Bagian laporan berdasarkan rentang kode. Akun 585–599 tidak punya induk di COA, jadi dikelompokkan di sini. */
export type ReportSection = { key: string; label: string; from: number; to: number; group: AccountGroupKey };

export const REPORT_SECTIONS: ReportSection[] = [
  { key: "aset-lancar", label: "Aset Lancar", from: 100, to: 129, group: "ASSET" },
  { key: "aset-tetap", label: "Aset Tetap", from: 130, to: 159, group: "ASSET" },
  { key: "aset-lain", label: "Aset Tidak Lancar Lainnya", from: 160, to: 199, group: "ASSET" },
  { key: "kewajiban-pendek", label: "Kewajiban Jangka Pendek", from: 200, to: 249, group: "LIABILITY" },
  { key: "kewajiban-panjang", label: "Kewajiban Jangka Panjang", from: 250, to: 299, group: "LIABILITY" },
  { key: "ekuitas", label: "Ekuitas", from: 300, to: 399, group: "EQUITY" },
  { key: "pendapatan-usaha", label: "Pendapatan Usaha", from: 400, to: 449, group: "REVENUE" },
  { key: "pendapatan-luar", label: "Pendapatan di Luar Usaha", from: 450, to: 499, group: "REVENUE" },
  { key: "hpp", label: "Harga Pokok Penjualan", from: 500, to: 519, group: "EXPENSE" },
  { key: "beban-sdm", label: "Beban Gaji dan Karyawan", from: 520, to: 539, group: "EXPENSE" },
  { key: "beban-adm", label: "Beban Administrasi dan Umum", from: 540, to: 569, group: "EXPENSE" },
  { key: "beban-pemasaran", label: "Beban Pemasaran", from: 570, to: 584, group: "EXPENSE" },
  { key: "beban-penyusutan", label: "Beban Penyusutan dan Amortisasi", from: 585, to: 590, group: "EXPENSE" },
  { key: "beban-lain", label: "Beban Keuangan dan Lain-lain", from: 591, to: 599, group: "EXPENSE" },
];

export function sectionForCode(code: string): ReportSection | null {
  const n = Number(code);
  if (!Number.isFinite(n)) return null;
  return REPORT_SECTIONS.find((s) => n >= s.from && n <= s.to) ?? null;
}

/** Format akuntansi: 0 → "–", negatif dalam kurung. */
export function formatAccounting(n: number): string {
  if (!n || Math.abs(n) < 0.005) return "–";
  const abs = Math.abs(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

export const DEFAULT_ACCOUNTS = {
  cash: "102",
  pettyCash: "101",
  employeeAdvance: "122",
  fundExpense: "569",
  income: "403",
  posIncome: "420",
  posExpense: "569",
  payrollExpense: "521",
  dailyWageExpense: "523",
  overtimeExpense: "524",
  allowanceExpense: "527",
  employeeReceivable: "111",
  bpjsKesExpense: "528",
  bpjsTkExpense: "529",
  pph21Payable: "214",
  bpjsKesPayable: "220",
  bpjsTkPayable: "221",
  receivable: "110",
} as const;

/** Akun aset tetap → akun akumulasi penyusutan & beban penyusutan. Tanah & aset dalam pembangunan tidak disusutkan. */
export const DEPRECIATION_MAP: Record<string, { accumulated: string; expense: string }> = {
  "132": { accumulated: "142", expense: "585" },
  "133": { accumulated: "143", expense: "586" },
  "134": { accumulated: "144", expense: "587" },
  "135": { accumulated: "145", expense: "588" },
  "136": { accumulated: "146", expense: "589" },
  "137": { accumulated: "147", expense: "588" },
  "138": { accumulated: "142", expense: "585" },
  "139": { accumulated: "148", expense: "587" },
  "140": { accumulated: "149", expense: "587" },
  "164": { accumulated: "169", expense: "590" },
  "165": { accumulated: "169", expense: "590" },
  "166": { accumulated: "169", expense: "590" },
  "167": { accumulated: "168", expense: "590" },
};

/** Umur ekonomis default (bulan) per akun aset — mengikuti kelompok harta pajak. */
export const DEFAULT_USEFUL_LIFE: Record<string, number> = {
  "132": 240,
  "133": 96,
  "134": 96,
  "135": 48,
  "136": 48,
  "137": 48,
  "138": 120,
  "139": 96,
  "140": 96,
  "164": 48,
  "165": 48,
  "166": 48,
  "167": 48,
};

export const FIXED_ASSET_ACCOUNTS = ["131", "132", "133", "134", "135", "136", "137", "138", "139", "140", "141", "164", "165", "166", "167"];
