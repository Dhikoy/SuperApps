import { prisma } from "@/lib/prisma";
import { getActiveCompanyCodes } from "@/lib/companies-server";
import { formatPeriodLabel, getPeriodRange } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";

export type CompanyFinanceRow = {
  company: string;
  pendapatan: number;
  penjualanPos: number;
  pengeluaranDana: number;
  pengeluaranPayroll: number;
  pengeluaranPos: number;
  totalMasuk: number;
  totalKeluar: number;
  laba: number;
};

export async function companyFinanceReport(year: number, month: number, company?: string) {
  const { start, end } = getPeriodRange(year, month);
  const codes = company ? [company.toUpperCase()] : await getActiveCompanyCodes();

  const [incomes, funds, payrolls, pos] = await Promise.all([
    prisma.incomeEntry.findMany({
      where: {
        entryDate: { gte: start, lte: end },
        source: { not: "POS" },
        ...(company ? { company: company.toUpperCase() } : {}),
      },
      select: { company: true, amount: true, title: true, entryDate: true },
    }),
    prisma.fundRequest.findMany({
      where: {
        status: "REALIZED",
        realizedAt: { gte: start, lte: end },
        ...(company ? { company: company.toUpperCase() } : {}),
      },
      select: { company: true, totalAmount: true, realizedAmount: true, title: true },
    }),
    prisma.payrollPosting.findMany({
      where: {
        year,
        month,
        ...(company ? { company: company.toUpperCase() } : {}),
      },
      select: { company: true, totalAmount: true },
    }),
    prisma.posTransaction.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        ...(company ? { company: company.toUpperCase() } : {}),
      },
      select: { company: true, type: true, amount: true },
    }),
  ]);

  const rows = new Map<string, CompanyFinanceRow>();
  for (const code of codes) {
    rows.set(code, emptyRow(code));
  }

  function row(code: string) {
    const key = code || "LAINNYA";
    let current = rows.get(key);
    if (!current) {
      current = emptyRow(key);
      rows.set(key, current);
    }
    return current;
  }

  for (const item of incomes) row(item.company).pendapatan += item.amount;
  for (const item of funds) row(item.company).pengeluaranDana += item.realizedAmount ?? item.totalAmount;
  for (const item of payrolls) row(item.company).pengeluaranPayroll += item.totalAmount;
  for (const item of pos) {
    if (item.type === "SALE") row(item.company).penjualanPos += item.amount;
    else row(item.company).pengeluaranPos += item.amount;
  }

  const list = [...rows.values()].map((item) => {
    const totalMasuk = item.pendapatan + item.penjualanPos;
    const totalKeluar = item.pengeluaranDana + item.pengeluaranPayroll + item.pengeluaranPos;
    return { ...item, totalMasuk, totalKeluar, laba: totalMasuk - totalKeluar };
  });

  const totals = list.reduce(
    (acc, item) => {
      acc.pendapatan += item.pendapatan;
      acc.penjualanPos += item.penjualanPos;
      acc.pengeluaranDana += item.pengeluaranDana;
      acc.pengeluaranPayroll += item.pengeluaranPayroll;
      acc.pengeluaranPos += item.pengeluaranPos;
      acc.totalMasuk += item.totalMasuk;
      acc.totalKeluar += item.totalKeluar;
      acc.laba += item.laba;
      return acc;
    },
    emptyRow("SEMUA")
  );

  return {
    periodLabel: formatPeriodLabel(year, month),
    year,
    month,
    companies: list,
    totals,
    lines: formatFinanceLines(list, totals, formatPeriodLabel(year, month)),
  };
}

function emptyRow(company: string): CompanyFinanceRow {
  return {
    company,
    pendapatan: 0,
    penjualanPos: 0,
    pengeluaranDana: 0,
    pengeluaranPayroll: 0,
    pengeluaranPos: 0,
    totalMasuk: 0,
    totalKeluar: 0,
    laba: 0,
  };
}

function formatFinanceLines(
  list: CompanyFinanceRow[],
  totals: CompanyFinanceRow,
  periodLabel: string
) {
  const body = list
    .map(
      (item) =>
        `${item.company}: masuk ${formatRupiah(item.totalMasuk)} (pendapatan ${formatRupiah(item.pendapatan)}, POS ${formatRupiah(item.penjualanPos)}) | keluar ${formatRupiah(item.totalKeluar)} (dana ${formatRupiah(item.pengeluaranDana)}, payroll ${formatRupiah(item.pengeluaranPayroll)}, POS ${formatRupiah(item.pengeluaranPos)}) | laba ${formatRupiah(item.laba)}`
    )
    .join("\n");
  return `Periode ${periodLabel}\n${body}\nTOTAL: masuk ${formatRupiah(totals.totalMasuk)} | keluar ${formatRupiah(totals.totalKeluar)} | laba ${formatRupiah(totals.laba)}`;
}
