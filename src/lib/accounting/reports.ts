import type { AccountGroup, NormalBalance } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { REPORT_SECTIONS, sectionForCode } from "./constants";
import { ensureCoaSeeded } from "./journal";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function startOfDayJakarta(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+07:00`);
}

export function endOfDayJakarta(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export type ReportFilter = { from: string; to: string; company: string | null };

/** Baca ?from=YYYY-MM-DD&to=YYYY-MM-DD&company=XXX; default bulan berjalan. */
export function parseReportFilter(params: URLSearchParams): ReportFilter {
  const today = todayJakarta();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const company = (params.get("company") ?? "").trim().toUpperCase();
  return {
    from: DATE_RE.test(from) ? from : `${today.slice(0, 8)}01`,
    to: DATE_RE.test(to) ? to : today,
    company: company && company !== "ALL" ? company : null,
  };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function sumByAccount(where: { company: string | null; gte?: Date; lt?: Date; lte?: Date }) {
  const rows = await prisma.journalLine.groupBy({
    by: ["accountCode"],
    where: {
      ...(where.company ? { company: where.company } : {}),
      date: {
        ...(where.gte ? { gte: where.gte } : {}),
        ...(where.lt ? { lt: where.lt } : {}),
        ...(where.lte ? { lte: where.lte } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });
  return new Map(rows.map((r) => [r.accountCode, { debit: r._sum.debit ?? 0, credit: r._sum.credit ?? 0 }]));
}

export async function loadAccounts() {
  await ensureCoaSeeded();
  return prisma.account.findMany({ orderBy: { code: "asc" } });
}

/** Saldo sesuai saldo normal akun (positif = sesuai sifat akun). */
export function naturalBalance(normal: NormalBalance, debit: number, credit: number) {
  return round2(normal === "DEBIT" ? debit - credit : credit - debit);
}

/** Arah tampilan laporan per kelompok (Neraca & Laba Rugi): aset/beban D−K, lainnya K−D. */
function groupBalance(group: AccountGroup, debit: number, credit: number) {
  return round2(group === "ASSET" || group === "EXPENSE" ? debit - credit : credit - debit);
}

// ---------- Neraca Saldo ----------

export type TrialBalanceRow = {
  code: string;
  name: string;
  group: AccountGroup;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
};

export async function trialBalance(filter: ReportFilter, opts: { showAll?: boolean } = {}) {
  const from = startOfDayJakarta(filter.from);
  const to = endOfDayJakarta(filter.to);
  const [accounts, before, during] = await Promise.all([
    loadAccounts(),
    sumByAccount({ company: filter.company, lt: from }),
    sumByAccount({ company: filter.company, gte: from, lte: to }),
  ]);

  const rows: TrialBalanceRow[] = [];
  for (const acc of accounts) {
    if (acc.isHeader) continue;
    const b = before.get(acc.code) ?? { debit: 0, credit: 0 };
    const d = during.get(acc.code) ?? { debit: 0, credit: 0 };
    const opening = round2(b.debit - b.credit);
    const closing = round2(opening + d.debit - d.credit);
    if (!opts.showAll && opening === 0 && d.debit === 0 && d.credit === 0) continue;
    rows.push({
      code: acc.code,
      name: acc.name,
      group: acc.group,
      opening,
      debit: round2(d.debit),
      credit: round2(d.credit),
      closing,
    });
  }

  const totals = rows.reduce(
    (t, r) => ({
      opening: round2(t.opening + r.opening),
      debit: round2(t.debit + r.debit),
      credit: round2(t.credit + r.credit),
      closing: round2(t.closing + r.closing),
    }),
    { opening: 0, debit: 0, credit: 0, closing: 0 }
  );

  return { filter, rows, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 };
}

// ---------- Laba Rugi ----------

export type SectionBlock = {
  key: string;
  label: string;
  rows: { code: string; name: string; amount: number }[];
  total: number;
};

function buildSections(
  accounts: Awaited<ReturnType<typeof loadAccounts>>,
  sums: Map<string, { debit: number; credit: number }>,
  groups: AccountGroup[]
): SectionBlock[] {
  const blocks = new Map<string, SectionBlock>();
  for (const section of REPORT_SECTIONS) {
    if (groups.includes(section.group)) blocks.set(section.key, { key: section.key, label: section.label, rows: [], total: 0 });
  }
  for (const acc of accounts) {
    if (acc.isHeader || !groups.includes(acc.group)) continue;
    const s = sums.get(acc.code);
    if (!s) continue;
    const amount = groupBalance(acc.group, s.debit, s.credit);
    if (amount === 0) continue;
    const section = sectionForCode(acc.code);
    const block = section ? blocks.get(section.key) : undefined;
    if (!block) continue;
    block.rows.push({ code: acc.code, name: acc.name, amount });
    block.total = round2(block.total + amount);
  }
  return [...blocks.values()];
}

export async function profitLoss(filter: ReportFilter) {
  const [accounts, sums] = await Promise.all([
    loadAccounts(),
    sumByAccount({ company: filter.company, gte: startOfDayJakarta(filter.from), lte: endOfDayJakarta(filter.to) }),
  ]);
  const sections = buildSections(accounts, sums, ["REVENUE", "EXPENSE"]);
  const total = (key: string) => sections.find((s) => s.key === key)?.total ?? 0;

  const pendapatanUsaha = total("pendapatan-usaha");
  const hpp = total("hpp");
  const labaKotor = round2(pendapatanUsaha - hpp);
  const bebanOperasional = round2(
    total("beban-sdm") + total("beban-adm") + total("beban-pemasaran") + total("beban-penyusutan")
  );
  const labaUsaha = round2(labaKotor - bebanOperasional);
  const pendapatanLuar = total("pendapatan-luar");
  const bebanLain = total("beban-lain");
  const labaBersih = round2(labaUsaha + pendapatanLuar - bebanLain);

  return {
    filter,
    sections,
    summary: { pendapatanUsaha, hpp, labaKotor, bebanOperasional, labaUsaha, pendapatanLuar, bebanLain, labaBersih },
  };
}

// ---------- Neraca ----------

export async function balanceSheet(filter: { asOf: string; company: string | null }) {
  const [accounts, sums] = await Promise.all([
    loadAccounts(),
    sumByAccount({ company: filter.company, lte: endOfDayJakarta(filter.asOf) }),
  ]);
  const sections = buildSections(accounts, sums, ["ASSET", "LIABILITY", "EQUITY"]);

  let revenue = 0;
  let expense = 0;
  for (const acc of accounts) {
    const s = sums.get(acc.code);
    if (!s) continue;
    if (acc.group === "REVENUE") revenue += s.credit - s.debit;
    if (acc.group === "EXPENSE") expense += s.debit - s.credit;
  }
  const currentEarnings = round2(revenue - expense);

  const sumGroup = (group: AccountGroup) =>
    round2(
      sections
        .filter((s) => REPORT_SECTIONS.find((r) => r.key === s.key)?.group === group)
        .reduce((t, s) => t + s.total, 0)
    );
  const totalAssets = sumGroup("ASSET");
  const totalLiabilities = sumGroup("LIABILITY");
  const totalEquity = round2(sumGroup("EQUITY") + currentEarnings);

  return {
    filter,
    sections,
    currentEarnings,
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      liabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    },
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

// ---------- Buku Besar ----------

export async function generalLedger(filter: ReportFilter & { accountCode: string }) {
  await ensureCoaSeeded();
  const account = await prisma.account.findUnique({ where: { code: filter.accountCode } });
  if (!account) return null;

  const from = startOfDayJakarta(filter.from);
  const to = endOfDayJakarta(filter.to);
  const companyWhere = filter.company ? { company: filter.company } : {};

  const [openingAgg, lines] = await Promise.all([
    prisma.journalLine.aggregate({
      where: { accountCode: account.code, ...companyWhere, date: { lt: from } },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.findMany({
      where: { accountCode: account.code, ...companyWhere, date: { gte: from, lte: to } },
      include: { entry: { select: { id: true, number: true, description: true, source: true } } },
      orderBy: [{ date: "asc" }, { entry: { number: "asc" } }, { sortOrder: "asc" }],
      take: 2000,
    }),
  ]);

  const opening = naturalBalance(account.normalBalance, openingAgg._sum.debit ?? 0, openingAgg._sum.credit ?? 0);
  let running = opening;
  const rows = lines.map((l) => {
    running = round2(running + naturalBalance(account.normalBalance, l.debit, l.credit));
    return {
      id: l.id,
      date: l.date.toISOString(),
      company: l.company,
      entryId: l.entry.id,
      number: l.entry.number,
      description: l.entry.description,
      source: l.entry.source,
      memo: l.memo,
      debit: l.debit,
      credit: l.credit,
      balance: running,
    };
  });

  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));

  return {
    filter,
    account: { code: account.code, name: account.name, group: account.group, normalBalance: account.normalBalance },
    opening,
    rows,
    totalDebit,
    totalCredit,
    closing: running,
  };
}
