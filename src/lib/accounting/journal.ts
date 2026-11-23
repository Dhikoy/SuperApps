import type { JournalSource, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPeriodRange } from "@/lib/period";
import { COA_SEED } from "./coa-data";
import { DEFAULT_ACCOUNTS, DEPRECIATION_MAP } from "./constants";

export type Db = Prisma.TransactionClient | typeof prisma;

export type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string | null;
};

export type JournalHeaderInput = {
  date: Date;
  company: string;
  description: string;
  createdBy: string;
};

export class JournalError extends Error {}

const SYSTEM_ACTOR = "system";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let coaReady = false;

/** Isi COA bawaan jika tabel akun masih kosong (mis. seed belum dijalankan). */
export async function ensureCoaSeeded(db: Db = prisma): Promise<void> {
  if (coaReady) return;
  const count = await db.account.count();
  if (count === 0) {
    await db.account.createMany({ data: COA_SEED });
  }
  coaReady = true;
}

function jakartaYearMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${y}${m}`;
}

async function nextJournalNumber(db: Db, date: Date): Promise<string> {
  const prefix = `JU-${jakartaYearMonth(date)}-`;
  const last = await db.journalEntry.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** Validasi baris jurnal: akun aktif & bukan induk, satu sisi per baris, debit = kredit. */
export async function validateLines(db: Db, input: JournalLineInput[]) {
  const lines = input
    .map((l) => ({
      accountCode: String(l.accountCode ?? "").trim(),
      debit: round2(Number(l.debit) || 0),
      credit: round2(Number(l.credit) || 0),
      memo: l.memo?.trim() || null,
    }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);

  if (lines.length < 2) throw new JournalError("Jurnal minimal 2 baris dengan nominal");

  for (const l of lines) {
    if (!l.accountCode) throw new JournalError("Setiap baris wajib memilih akun");
    if (l.debit < 0 || l.credit < 0) throw new JournalError("Nominal debit/kredit tidak boleh negatif");
    if (l.debit > 0 && l.credit > 0) {
      throw new JournalError(`Akun ${l.accountCode}: isi debit atau kredit saja, tidak keduanya`);
    }
  }

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new JournalError(
      `Jurnal tidak seimbang: debit ${totalDebit.toLocaleString("id-ID")} ≠ kredit ${totalCredit.toLocaleString("id-ID")}`
    );
  }

  await ensureCoaSeeded(db);
  const codes = [...new Set(lines.map((l) => l.accountCode))];
  const accounts = await db.account.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of codes) {
    const acc = byCode.get(code);
    if (!acc) throw new JournalError(`Akun ${code} tidak ada di COA`);
    if (acc.isHeader) throw new JournalError(`Akun ${code} ${acc.name} adalah akun induk, tidak bisa dijurnal`);
    if (!acc.active) throw new JournalError(`Akun ${code} ${acc.name} nonaktif`);
  }

  return { lines, totalDebit, totalCredit };
}

/** Pastikan kode akun valid untuk kelompok tertentu (dipakai saat menyimpan pilihan akun di form). */
export async function assertAccount(
  db: Db,
  code: string | null | undefined,
  opts: { label: string; groups?: string[]; cash?: boolean }
): Promise<string | null> {
  const value = String(code ?? "").trim();
  if (!value) return null;
  await ensureCoaSeeded(db);
  const acc = await db.account.findUnique({ where: { code: value } });
  if (!acc) throw new JournalError(`${opts.label}: akun ${value} tidak ada di COA`);
  if (acc.isHeader) throw new JournalError(`${opts.label}: ${value} adalah akun induk`);
  if (!acc.active) throw new JournalError(`${opts.label}: akun ${value} nonaktif`);
  if (opts.groups && !opts.groups.includes(acc.group)) {
    throw new JournalError(`${opts.label}: akun ${value} ${acc.name} bukan kelompok yang sesuai`);
  }
  if (opts.cash && !acc.isCash) throw new JournalError(`${opts.label}: akun ${value} bukan akun kas/bank`);
  return value;
}

// ---------- Tutup buku ----------

export const LOCK_DATE_KEY = "lockDate";

/** Tanggal tutup buku (YYYY-MM-DD) atau null jika belum pernah ditutup. */
export async function getLockDate(db: Db = prisma): Promise<string | null> {
  const row = await db.accountingSetting.findUnique({ where: { key: LOCK_DATE_KEY } });
  return row?.value || null;
}

function lockDateEnd(lockDate: string): Date {
  return new Date(`${lockDate}T23:59:59.999+07:00`);
}

function formatYmdId(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export async function assertPeriodOpen(db: Db, ...dates: (Date | null | undefined)[]) {
  const lockDate = await getLockDate(db);
  if (!lockDate) return;
  const end = lockDateEnd(lockDate);
  if (dates.some((d) => d && d.getTime() <= end.getTime())) {
    throw new JournalError(
      `Periode sudah tutup buku s/d ${formatYmdId(lockDate)} — transaksi pada tanggal tersebut tidak bisa diubah`
    );
  }
}

function lineRows(entryId: string, header: { date: Date; company: string }, lines: Awaited<ReturnType<typeof validateLines>>["lines"]) {
  return lines.map((l, i) => ({
    entryId,
    accountCode: l.accountCode,
    date: header.date,
    company: header.company,
    debit: l.debit,
    credit: l.credit,
    memo: l.memo,
    sortOrder: i,
  }));
}

export async function createJournal(
  db: Db,
  header: JournalHeaderInput & { source?: JournalSource; sourceId?: string | null },
  input: JournalLineInput[]
) {
  const { lines } = await validateLines(db, input);
  await assertPeriodOpen(db, header.date);
  const company = header.company.trim().toUpperCase();
  const entry = await db.journalEntry.create({
    data: {
      number: await nextJournalNumber(db, header.date),
      date: header.date,
      company,
      description: header.description.trim().slice(0, 300),
      source: header.source ?? "MANUAL",
      sourceId: header.sourceId ?? null,
      createdBy: header.createdBy,
    },
  });
  await db.journalLine.createMany({ data: lineRows(entry.id, { date: header.date, company }, lines) });
  return entry;
}

export async function updateJournal(
  db: Db,
  id: string,
  header: Omit<JournalHeaderInput, "createdBy"> & { source?: JournalSource },
  input: JournalLineInput[]
) {
  const { lines } = await validateLines(db, input);
  const previous = await db.journalEntry.findUnique({ where: { id }, select: { date: true } });
  await assertPeriodOpen(db, header.date, previous?.date);
  const company = header.company.trim().toUpperCase();
  const entry = await db.journalEntry.update({
    where: { id },
    data: {
      date: header.date,
      company,
      description: header.description.trim().slice(0, 300),
      ...(header.source ? { source: header.source } : {}),
    },
  });
  await db.journalLine.deleteMany({ where: { entryId: id } });
  await db.journalLine.createMany({ data: lineRows(id, { date: header.date, company }, lines) });
  return entry;
}

async function upsertSourceJournal(
  db: Db,
  source: JournalSource,
  sourceId: string,
  header: JournalHeaderInput,
  lines: JournalLineInput[]
) {
  const existing = await db.journalEntry.findFirst({
    where: { source, sourceId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (lines.length === 0) {
    if (existing) await deleteJournal(db, existing.id);
    return null;
  }
  if (existing) {
    if (await sameJournal(db, existing, header, lines)) return existing;
    return updateJournal(db, existing.id, header, lines);
  }
  return createJournal(db, { ...header, source, sourceId }, lines);
}

/** Jurnal otomatis yang isinya tidak berubah tidak ditulis ulang (agar tidak terblok tutup buku). */
async function sameJournal(
  db: Db,
  existing: { date: Date; company: string; description: string; lines: { accountCode: string; debit: number; credit: number; memo: string | null }[] },
  header: JournalHeaderInput,
  input: JournalLineInput[]
) {
  if (existing.date.getTime() !== header.date.getTime()) return false;
  if (existing.company !== header.company.trim().toUpperCase()) return false;
  if (existing.description !== header.description.trim().slice(0, 300)) return false;
  const { lines } = await validateLines(db, input);
  if (lines.length !== existing.lines.length) return false;
  return lines.every((l, i) => {
    const e = existing.lines[i];
    return e.accountCode === l.accountCode && e.debit === l.debit && e.credit === l.credit && (e.memo ?? null) === l.memo;
  });
}

export async function deleteJournal(db: Db, id: string) {
  const entry = await db.journalEntry.findUnique({ where: { id }, select: { date: true } });
  if (!entry) return;
  await assertPeriodOpen(db, entry.date);
  await db.journalEntry.delete({ where: { id } });
}

export async function deleteSourceJournal(db: Db, source: JournalSource, sourceId: string) {
  const entries = await db.journalEntry.findMany({ where: { source, sourceId }, select: { date: true } });
  if (entries.length === 0) return;
  await assertPeriodOpen(db, ...entries.map((e) => e.date));
  await db.journalEntry.deleteMany({ where: { source, sourceId } });
}

// ---------- Pengajuan dana ----------

type FundForJournal = {
  id: string;
  title: string;
  company: string;
  totalAmount: number;
  status: string;
  paidAt: Date | null;
  paidBy: string | null;
  paidFromAccount: string | null;
  realizedAt: Date | null;
  realizedBy: string | null;
  realizedAmount: number | null;
  items: { itemName: string; subtotal: number; accountCode: string | null }[];
};

export function fundPaymentLines(fr: FundForJournal): JournalLineInput[] {
  if (!(fr.totalAmount > 0)) return [];
  const cash = fr.paidFromAccount || DEFAULT_ACCOUNTS.cash;
  return [
    { accountCode: DEFAULT_ACCOUNTS.employeeAdvance, debit: fr.totalAmount, memo: fr.title },
    { accountCode: cash, credit: fr.totalAmount, memo: fr.title },
  ];
}

/** Uang muka (122) ditutup ke akun beban per item; selisih nominal aktual dijurnal ke kas/bank pembayaran. */
export function fundRealizationLines(fr: FundForJournal): JournalLineInput[] {
  const paid = round2(fr.totalAmount);
  if (!(paid > 0)) return [];
  const actual = round2(fr.realizedAmount ?? paid);
  const cash = fr.paidFromAccount || DEFAULT_ACCOUNTS.cash;

  const byAccount = new Map<string, { amount: number; names: string[] }>();
  for (const item of fr.items) {
    const code = item.accountCode || DEFAULT_ACCOUNTS.fundExpense;
    const row = byAccount.get(code) ?? { amount: 0, names: [] };
    row.amount += item.subtotal;
    row.names.push(item.itemName);
    byAccount.set(code, row);
  }
  if (byAccount.size === 0) byAccount.set(DEFAULT_ACCOUNTS.fundExpense, { amount: paid, names: [fr.title] });

  const itemsTotal = [...byAccount.values()].reduce((s, r) => s + r.amount, 0) || paid;
  const expense: JournalLineInput[] = [];
  let allocated = 0;
  const entries = [...byAccount.entries()];
  entries.forEach(([code, row], idx) => {
    const amount =
      idx === entries.length - 1 ? round2(actual - allocated) : round2((row.amount / itemsTotal) * actual);
    allocated = round2(allocated + amount);
    if (amount !== 0) expense.push({ accountCode: code, debit: amount, memo: row.names.join(", ").slice(0, 200) });
  });

  const lines: JournalLineInput[] = [
    ...expense,
    { accountCode: DEFAULT_ACCOUNTS.employeeAdvance, credit: paid, memo: fr.title },
  ];
  const diff = round2(paid - actual);
  if (diff > 0) lines.push({ accountCode: cash, debit: diff, memo: "Pengembalian sisa dana" });
  if (diff < 0) lines.push({ accountCode: cash, credit: -diff, memo: "Kekurangan dana dibayarkan" });
  return lines;
}

export async function syncFundRequestJournals(db: Db, fundRequestId: string) {
  const fr = await db.fundRequest.findUnique({
    where: { id: fundRequestId },
    select: {
      id: true,
      title: true,
      company: true,
      totalAmount: true,
      status: true,
      paymentRef: true,
      paidAt: true,
      paidBy: true,
      paidFromAccount: true,
      realizedAt: true,
      realizedBy: true,
      realizedAmount: true,
      updatedAt: true,
      items: { select: { itemName: true, subtotal: true, accountCode: true } },
    },
  });
  if (!fr) {
    await deleteSourceJournal(db, "FUND_PAYMENT", fundRequestId);
    await deleteSourceJournal(db, "FUND_REALIZATION", fundRequestId);
    return;
  }

  const paid = fr.status === "PAID" || fr.status === "REALIZED";
  if (paid) {
    await upsertSourceJournal(
      db,
      "FUND_PAYMENT",
      fr.id,
      {
        date: fr.paidAt ?? fr.updatedAt,
        company: fr.company,
        description: `Pembayaran pengajuan: ${fr.title}${fr.paymentRef ? ` (ref ${fr.paymentRef})` : ""}`,
        createdBy: fr.paidBy ?? SYSTEM_ACTOR,
      },
      fundPaymentLines(fr)
    );
  } else {
    await deleteSourceJournal(db, "FUND_PAYMENT", fr.id);
  }

  if (fr.status === "REALIZED") {
    await upsertSourceJournal(
      db,
      "FUND_REALIZATION",
      fr.id,
      {
        date: fr.realizedAt ?? fr.updatedAt,
        company: fr.company,
        description: `Realisasi pengajuan: ${fr.title}`,
        createdBy: fr.realizedBy ?? SYSTEM_ACTOR,
      },
      fundRealizationLines(fr)
    );
  } else {
    await deleteSourceJournal(db, "FUND_REALIZATION", fr.id);
  }
}

// ---------- Pendapatan (manual, invoice, POS penjualan) ----------

export function incomeDefaults(source: string) {
  return source === "POS"
    ? { cash: DEFAULT_ACCOUNTS.pettyCash, income: DEFAULT_ACCOUNTS.posIncome }
    : { cash: DEFAULT_ACCOUNTS.cash, income: DEFAULT_ACCOUNTS.income };
}

export async function syncIncomeJournal(db: Db, incomeId: string) {
  const entry = await db.incomeEntry.findUnique({ where: { id: incomeId } });
  if (!entry || !(entry.amount > 0)) {
    await deleteSourceJournal(db, "INCOME", incomeId);
    return;
  }
  const defaults = incomeDefaults(entry.source);
  const invoice = await db.invoice.findFirst({
    where: { syncedIncomeId: entry.id },
    select: { docType: true, status: true },
  });
  const settlesReceivable = invoice ? invoiceAccrues(invoice) : false;
  await upsertSourceJournal(
    db,
    "INCOME",
    entry.id,
    {
      date: entry.entryDate,
      company: entry.company,
      description: settlesReceivable ? `Pelunasan piutang: ${entry.title}` : `Pendapatan: ${entry.title}`,
      createdBy: entry.createdBy,
    },
    [
      { accountCode: entry.cashAccount || defaults.cash, debit: entry.amount, memo: entry.title },
      {
        accountCode: settlesReceivable ? DEFAULT_ACCOUNTS.receivable : entry.accountCode || defaults.income,
        credit: entry.amount,
        memo: entry.title,
      },
    ]
  );
}

// ---------- Piutang invoice ----------

/** Invoice yang sudah terbit dicatat sebagai piutang; kwitansi langsung kas saat sync. */
export function invoiceAccrues(inv: { docType: string; status: string }) {
  return inv.docType === "INVOICE" && (inv.status === "ISSUED" || inv.status === "PAID");
}

export async function syncInvoiceJournal(db: Db, invoiceId: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) {
    await deleteSourceJournal(db, "INVOICE", invoiceId);
    return;
  }
  if (!invoiceAccrues(inv) || !(inv.totalAmount > 0)) {
    await deleteSourceJournal(db, "INVOICE", inv.id);
  } else {
    const income = inv.syncedIncomeId
      ? await db.incomeEntry.findUnique({ where: { id: inv.syncedIncomeId }, select: { accountCode: true } })
      : null;
    const revenueAccount = inv.accountCode || income?.accountCode || DEFAULT_ACCOUNTS.income;
    const tax = round2(Math.max(0, Math.min(inv.taxAmount || 0, inv.totalAmount)));
    const customer = inv.customerName || inv.receivedFrom || "";
    const memo = `${inv.invoiceNumber}${customer ? ` — ${customer}` : ""}`.slice(0, 200);
    const lines: JournalLineInput[] = [
      { accountCode: DEFAULT_ACCOUNTS.receivable, debit: inv.totalAmount, memo },
      { accountCode: revenueAccount, credit: round2(inv.totalAmount - tax), memo },
    ];
    if (tax > 0) lines.push({ accountCode: "218", credit: tax, memo: `PPN ${inv.invoiceNumber}` });
    await upsertSourceJournal(
      db,
      "INVOICE",
      inv.id,
      { date: inv.issueDate, company: inv.company, description: `Piutang invoice ${memo}`, createdBy: inv.createdBy },
      lines
    );
  }
  if (inv.syncedIncomeId) await syncIncomeJournal(db, inv.syncedIncomeId);
}

// ---------- POS pengeluaran ----------

export async function syncPosJournal(db: Db, posId: string) {
  const tx = await db.posTransaction.findUnique({ where: { id: posId } });
  if (!tx || tx.type !== "EXPENSE" || !(tx.amount > 0)) {
    await deleteSourceJournal(db, "POS_EXPENSE", posId);
    return;
  }
  const memo = tx.description ?? `Pengeluaran POS ${tx.company}`;
  await upsertSourceJournal(
    db,
    "POS_EXPENSE",
    tx.id,
    { date: tx.transactionDate, company: tx.company, description: `Pengeluaran POS: ${memo}`, createdBy: SYSTEM_ACTOR },
    [
      { accountCode: tx.accountCode || DEFAULT_ACCOUNTS.posExpense, debit: tx.amount, memo },
      { accountCode: tx.cashAccount || DEFAULT_ACCOUNTS.pettyCash, credit: tx.amount, memo },
    ]
  );
}

// ---------- Payroll ----------

export async function syncPayrollJournal(db: Db, postingId: string) {
  const posting = await db.payrollPosting.findUnique({ where: { id: postingId } });
  if (!posting || !(posting.totalAmount > 0)) {
    await deleteSourceJournal(db, "PAYROLL", postingId);
    return;
  }
  const label = `Gaji periode ${String(posting.month).padStart(2, "0")}/${posting.year} (${posting.employeeCount} karyawan)`;
  const cash = posting.cashAccount || DEFAULT_ACCOUNTS.cash;
  const breakdown = parsePayrollBreakdown(posting.breakdown);
  await upsertSourceJournal(
    db,
    "PAYROLL",
    posting.id,
    {
      date: getPeriodRange(posting.year, posting.month).end,
      company: posting.company,
      description: `Payroll: ${label}`,
      createdBy: posting.postedBy,
    },
    breakdown
      ? payrollLines(breakdown, posting.withholding, cash, label)
      : [
          { accountCode: DEFAULT_ACCOUNTS.payrollExpense, debit: posting.totalAmount, memo: label },
          { accountCode: cash, credit: posting.totalAmount, memo: label },
        ]
  );
}

export type PayrollBreakdown = {
  salary: number;
  dailyWage: number;
  overtime: number;
  /** Tunjangan + uang makan */
  allowance: number;
  penalty: number;
  /** Potongan lain (kasbon/pinjaman karyawan) */
  deduction: number;
  bpjsKesEmployer: number;
  bpjsTkEmployer: number;
  bpjsKesEmployee: number;
  bpjsTkEmployee: number;
  pph21: number;
};

export const EMPTY_PAYROLL_BREAKDOWN: PayrollBreakdown = {
  salary: 0,
  dailyWage: 0,
  overtime: 0,
  allowance: 0,
  penalty: 0,
  deduction: 0,
  bpjsKesEmployer: 0,
  bpjsTkEmployer: 0,
  bpjsKesEmployee: 0,
  bpjsTkEmployee: 0,
  pph21: 0,
};

function parsePayrollBreakdown(raw: string | null): PayrollBreakdown | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PayrollBreakdown>;
    return { ...EMPTY_PAYROLL_BREAKDOWN, ...parsed };
  } catch {
    return null;
  }
}

/** Gaji bersih yang dibayarkan dari kas. */
export function payrollNetPay(b: PayrollBreakdown, withholding: boolean) {
  const gross = b.salary + b.dailyWage + b.overtime + b.allowance - b.penalty - b.deduction;
  return round2(withholding ? gross - b.bpjsKesEmployee - b.bpjsTkEmployee - b.pph21 : gross);
}

/**
 * Beban gaji/upah/lembur/tunjangan + BPJS bagian perusahaan; denda mengurangi beban gaji,
 * potongan lain melunasi piutang karyawan (kasbon).
 * Bila withholding: BPJS karyawan & PPh 21 ditahan sebagai utang, kas = gaji bersih.
 */
export function payrollLines(b: PayrollBreakdown, withholding: boolean, cash: string, memo: string): JournalLineInput[] {
  const net = payrollNetPay(b, withholding);
  if (net < 0) throw new JournalError("Gaji bersih negatif — cek potongan denda/PPh 21/BPJS");
  const kesPayable = b.bpjsKesEmployer + (withholding ? b.bpjsKesEmployee : 0);
  const tkPayable = b.bpjsTkEmployer + (withholding ? b.bpjsTkEmployee : 0);
  return [
    { accountCode: DEFAULT_ACCOUNTS.payrollExpense, debit: b.salary, memo },
    { accountCode: DEFAULT_ACCOUNTS.dailyWageExpense, debit: b.dailyWage, memo },
    { accountCode: DEFAULT_ACCOUNTS.overtimeExpense, debit: b.overtime, memo: "Lembur" },
    { accountCode: DEFAULT_ACCOUNTS.allowanceExpense, debit: b.allowance, memo: "Tunjangan & uang makan" },
    { accountCode: DEFAULT_ACCOUNTS.bpjsKesExpense, debit: b.bpjsKesEmployer, memo: "BPJS Kesehatan (perusahaan)" },
    { accountCode: DEFAULT_ACCOUNTS.bpjsTkExpense, debit: b.bpjsTkEmployer, memo: "BPJS Ketenagakerjaan (perusahaan)" },
    { accountCode: DEFAULT_ACCOUNTS.payrollExpense, credit: b.penalty, memo: "Potongan denda karyawan" },
    { accountCode: DEFAULT_ACCOUNTS.employeeReceivable, credit: b.deduction, memo: "Potongan gaji (kasbon/pinjaman karyawan)" },
    { accountCode: DEFAULT_ACCOUNTS.bpjsKesPayable, credit: kesPayable, memo: "Utang BPJS Kesehatan" },
    { accountCode: DEFAULT_ACCOUNTS.bpjsTkPayable, credit: tkPayable, memo: "Utang BPJS Ketenagakerjaan" },
    { accountCode: DEFAULT_ACCOUNTS.pph21Payable, credit: withholding ? b.pph21 : 0, memo: "PPh 21 dipotong" },
    { accountCode: cash, credit: net, memo: `${memo} — gaji dibayarkan` },
  ];
}

// ---------- Penyusutan aset tetap ----------

type DepreciableAsset = {
  id: string;
  laptop: string;
  acquisitionCost: number | null;
  acquisitionDate: Date | null;
  usefulLifeMonths: number | null;
  residualValue: number;
  assetAccount: string | null;
};

function monthIndex(year: number, month: number) {
  return year * 12 + (month - 1);
}

function jakartaMonthIndex(date: Date) {
  const ym = jakartaYearMonth(date);
  return monthIndex(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)));
}

/** Garis lurus mulai bulan perolehan; bulan terakhir menyerap selisih pembulatan. */
export function depreciationForMonth(asset: DepreciableAsset, year: number, month: number) {
  if (!asset.acquisitionCost || !asset.acquisitionDate || !asset.usefulLifeMonths) return 0;
  if (!asset.assetAccount || !DEPRECIATION_MAP[asset.assetAccount]) return 0;
  const base = Math.max(0, asset.acquisitionCost - (asset.residualValue || 0));
  const elapsed = monthIndex(year, month) - jakartaMonthIndex(asset.acquisitionDate);
  if (elapsed < 0 || elapsed >= asset.usefulLifeMonths) return 0;
  const monthly = round2(base / asset.usefulLifeMonths);
  if (elapsed === asset.usefulLifeMonths - 1) return round2(base - monthly * (asset.usefulLifeMonths - 1));
  return monthly;
}

/** Akumulasi penyusutan s/d akhir bulan (inklusif). */
export function accumulatedDepreciation(asset: DepreciableAsset, year: number, month: number) {
  if (!asset.acquisitionCost || !asset.acquisitionDate || !asset.usefulLifeMonths) return 0;
  if (!asset.assetAccount || !DEPRECIATION_MAP[asset.assetAccount]) return 0;
  const base = Math.max(0, asset.acquisitionCost - (asset.residualValue || 0));
  const elapsed = monthIndex(year, month) - jakartaMonthIndex(asset.acquisitionDate) + 1;
  if (elapsed <= 0) return 0;
  if (elapsed >= asset.usefulLifeMonths) return round2(base);
  return round2((base / asset.usefulLifeMonths) * elapsed);
}

export function depreciationSourceId(company: string, year: number, month: number) {
  return `${company.toUpperCase()}:${year}-${String(month).padStart(2, "0")}`;
}

export async function syncDepreciationJournal(db: Db, company: string, year: number, month: number, createdBy: string) {
  const assets = await db.asset.findMany({
    where: { company, acquisitionCost: { gt: 0 }, usefulLifeMonths: { gt: 0 } },
    select: {
      id: true,
      laptop: true,
      acquisitionCost: true,
      acquisitionDate: true,
      usefulLifeMonths: true,
      residualValue: true,
      assetAccount: true,
    },
  });

  const byPair = new Map<string, { expense: string; accumulated: string; amount: number; names: string[] }>();
  for (const asset of assets) {
    const amount = depreciationForMonth(asset, year, month);
    if (!(amount > 0)) continue;
    const map = DEPRECIATION_MAP[asset.assetAccount!];
    const key = `${map.expense}|${map.accumulated}`;
    const row = byPair.get(key) ?? { ...map, amount: 0, names: [] };
    row.amount = round2(row.amount + amount);
    row.names.push(asset.laptop);
    byPair.set(key, row);
  }

  const lines: JournalLineInput[] = [];
  for (const row of byPair.values()) {
    const memo = row.names.join(", ").slice(0, 200);
    lines.push({ accountCode: row.expense, debit: row.amount, memo });
    lines.push({ accountCode: row.accumulated, credit: row.amount, memo });
  }

  const total = round2([...byPair.values()].reduce((s, r) => s + r.amount, 0));
  const label = `${String(month).padStart(2, "0")}/${year}`;
  await upsertSourceJournal(
    db,
    "DEPRECIATION",
    depreciationSourceId(company, year, month),
    {
      date: new Date(`${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}T12:00:00+07:00`),
      company,
      description: `Penyusutan aset tetap ${label}`,
      createdBy,
    },
    lines
  );
  return { total, assetCount: [...byPair.values()].reduce((s, r) => s + r.names.length, 0) };
}
