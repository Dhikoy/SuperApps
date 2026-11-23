import type { AccountGroup } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACCOUNTS } from "./constants";
import {
  endOfDayJakarta,
  loadAccounts,
  round2,
  startOfDayJakarta,
  sumByAccount,
  type ReportFilter,
} from "./reports";

const DAY_MS = 86_400_000;
export const DEFAULT_TERM_DAYS = 30;

// ---------- Umur Piutang ----------

export const AGING_BUCKETS = [
  { key: "current", label: "Belum jatuh tempo" },
  { key: "d30", label: "1–30 hari" },
  { key: "d60", label: "31–60 hari" },
  { key: "d90", label: "61–90 hari" },
  { key: "over90", label: "> 90 hari" },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

function bucketFor(daysOverdue: number): AgingBucketKey {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d30";
  if (daysOverdue <= 60) return "d60";
  if (daysOverdue <= 90) return "d90";
  return "over90";
}

/** Invoice terbit yang belum lunas per tanggal; jatuh tempo default 30 hari bila kosong. */
export async function receivableAging(filter: { asOf: string; company: string | null }) {
  const asOfEnd = endOfDayJakarta(filter.asOf);
  const invoices = await prisma.invoice.findMany({
    where: {
      docType: "INVOICE",
      status: { in: ["ISSUED", "PAID"] },
      issueDate: { lte: asOfEnd },
      ...(filter.company ? { company: filter.company } : {}),
    },
    orderBy: { issueDate: "asc" },
  });

  const incomeIds = invoices.map((i) => i.syncedIncomeId).filter((id): id is string => Boolean(id));
  const incomes = incomeIds.length
    ? await prisma.incomeEntry.findMany({ where: { id: { in: incomeIds } }, select: { id: true, entryDate: true } })
    : [];
  const paidAt = new Map(incomes.map((i) => [i.id, i.entryDate]));

  const totals: Record<AgingBucketKey, number> = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
  const rows = [];
  for (const inv of invoices) {
    const paidDate = inv.syncedIncomeId ? paidAt.get(inv.syncedIncomeId) : undefined;
    if (inv.status === "PAID" && (!paidDate || paidDate.getTime() <= asOfEnd.getTime())) continue;

    const due = inv.dueDate ?? new Date(inv.issueDate.getTime() + DEFAULT_TERM_DAYS * DAY_MS);
    const daysOverdue = Math.floor((asOfEnd.getTime() - due.getTime()) / DAY_MS);
    const bucket = bucketFor(daysOverdue);
    totals[bucket] = round2(totals[bucket] + inv.totalAmount);
    rows.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      company: inv.company,
      customer: inv.customerName || inv.receivedFrom || "-",
      issueDate: inv.issueDate.toISOString(),
      dueDate: due.toISOString(),
      defaultTerm: !inv.dueDate,
      daysOverdue: Math.max(0, daysOverdue),
      amount: inv.totalAmount,
      bucket,
    });
  }

  const total = round2(Object.values(totals).reduce((s, v) => s + v, 0));
  const ledger = await prisma.journalLine.aggregate({
    where: {
      accountCode: DEFAULT_ACCOUNTS.receivable,
      date: { lte: asOfEnd },
      ...(filter.company ? { company: filter.company } : {}),
    },
    _sum: { debit: true, credit: true },
  });
  const ledgerBalance = round2((ledger._sum.debit ?? 0) - (ledger._sum.credit ?? 0));

  const byCustomer = new Map<string, { customer: string; total: number; count: number }>();
  for (const r of rows) {
    const c = byCustomer.get(r.customer) ?? { customer: r.customer, total: 0, count: 0 };
    c.total = round2(c.total + r.amount);
    c.count += 1;
    byCustomer.set(r.customer, c);
  }

  return {
    filter,
    rows,
    totals,
    total,
    ledgerBalance,
    customers: [...byCustomer.values()].sort((a, b) => b.total - a.total),
  };
}

// ---------- Arus Kas ----------

export type CashFlowCategory = "operating" | "investing" | "financing";

export const CASH_FLOW_LABELS: Record<CashFlowCategory, string> = {
  operating: "Aktivitas Operasional",
  investing: "Aktivitas Investasi",
  financing: "Aktivitas Pendanaan",
};

function cashFlowCategory(code: string, group: AccountGroup): CashFlowCategory {
  if (group === "REVENUE" || group === "EXPENSE") return "operating";
  const n = Number(code);
  if (n >= 130 && n <= 199) return "investing";
  if (n >= 250) return "financing";
  return "operating";
}

/**
 * Metode langsung dari jurnal: setiap jurnal yang menyentuh kas/bank, baris lawannya
 * (kredit − debit) menjadi arus masuk/keluar per akun. Transfer antar kas tidak dihitung.
 */
export async function cashFlow(filter: ReportFilter) {
  const from = startOfDayJakarta(filter.from);
  const to = endOfDayJakarta(filter.to);
  const companyWhere = filter.company ? { company: filter.company } : {};

  const accounts = await loadAccounts();
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const cashCodes = accounts.filter((a) => a.isCash).map((a) => a.code);

  const [openingAgg, closingAgg, lines] = await Promise.all([
    prisma.journalLine.aggregate({
      where: { accountCode: { in: cashCodes }, ...companyWhere, date: { lt: from } },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: { accountCode: { in: cashCodes }, ...companyWhere, date: { lte: to } },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.findMany({
      where: {
        ...companyWhere,
        date: { gte: from, lte: to },
        accountCode: { notIn: cashCodes },
        entry: { lines: { some: { accountCode: { in: cashCodes } } } },
      },
      select: { accountCode: true, debit: true, credit: true },
    }),
  ]);

  const flows = new Map<string, number>();
  for (const l of lines) flows.set(l.accountCode, round2((flows.get(l.accountCode) ?? 0) + l.credit - l.debit));

  const sections = (Object.keys(CASH_FLOW_LABELS) as CashFlowCategory[]).map((key) => {
    const rows = [...flows.entries()]
      .filter(([code, amount]) => amount !== 0 && byCode.get(code) && cashFlowCategory(code, byCode.get(code)!.group) === key)
      .map(([code, amount]) => ({ code, name: byCode.get(code)!.name, amount }))
      .sort((a, b) => a.code.localeCompare(b.code));
    const inflow = round2(rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0));
    const outflow = round2(rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0));
    return { key, label: CASH_FLOW_LABELS[key], rows, inflow, outflow, net: round2(inflow + outflow) };
  });

  const opening = round2((openingAgg._sum.debit ?? 0) - (openingAgg._sum.credit ?? 0));
  const closing = round2((closingAgg._sum.debit ?? 0) - (closingAgg._sum.credit ?? 0));
  const netChange = round2(sections.reduce((s, sec) => s + sec.net, 0));

  return {
    filter,
    sections,
    opening,
    netChange,
    closing,
    reconciled: Math.abs(opening + netChange - closing) < 0.01,
  };
}

// ---------- Anggaran vs Realisasi ----------

export function monthsInRange(from: string, to: string) {
  const out: { year: number; month: number }[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 120) break;
  }
  return out;
}

export async function budgetVsActual(filter: ReportFilter) {
  const months = monthsInRange(filter.from, filter.to);
  const [accounts, sums, budgets] = await Promise.all([
    loadAccounts(),
    sumByAccount({ company: filter.company, gte: startOfDayJakarta(filter.from), lte: endOfDayJakarta(filter.to) }),
    prisma.budget.findMany({
      where: {
        OR: months.map((p) => ({ year: p.year, month: p.month })),
        ...(filter.company ? { company: filter.company } : {}),
      },
      select: { accountCode: true, amount: true },
    }),
  ]);

  const budgetByCode = new Map<string, number>();
  for (const b of budgets) budgetByCode.set(b.accountCode, round2((budgetByCode.get(b.accountCode) ?? 0) + b.amount));

  const build = (group: "REVENUE" | "EXPENSE") => {
    const rows = accounts
      .filter((a) => !a.isHeader && a.group === group)
      .map((a) => {
        const s = sums.get(a.code) ?? { debit: 0, credit: 0 };
        const actual = round2(group === "EXPENSE" ? s.debit - s.credit : s.credit - s.debit);
        const budget = budgetByCode.get(a.code) ?? 0;
        const variance = round2(group === "EXPENSE" ? budget - actual : actual - budget);
        return {
          code: a.code,
          name: a.name,
          budget,
          actual,
          variance,
          pct: budget !== 0 ? round2((actual / budget) * 100) : null,
        };
      })
      .filter((r) => r.budget !== 0 || r.actual !== 0);
    const budget = round2(rows.reduce((s, r) => s + r.budget, 0));
    const actual = round2(rows.reduce((s, r) => s + r.actual, 0));
    return {
      rows,
      budget,
      actual,
      variance: round2(group === "EXPENSE" ? budget - actual : actual - budget),
      pct: budget !== 0 ? round2((actual / budget) * 100) : null,
    };
  };

  const revenue = build("REVENUE");
  const expense = build("EXPENSE");
  return {
    filter,
    months: months.length,
    revenue,
    expense,
    net: { budget: round2(revenue.budget - expense.budget), actual: round2(revenue.actual - expense.actual) },
  };
}
