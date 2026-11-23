import ExcelJS from "exceljs";
import type { balanceSheet, generalLedger, profitLoss, trialBalance } from "./reports";
import { AGING_BUCKETS, type budgetVsActual, type cashFlow, type receivableAging } from "./reports-extra";

const MONEY = '#,##0;(#,##0);"-"';

function sheetWithTitle(wb: ExcelJS.Workbook, name: string, title: string, subtitle: string) {
  const ws = wb.addWorksheet(name);
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([subtitle]).font = { color: { argb: "FF64748B" } };
  ws.addRow([]);
  return ws;
}

function headerRow(ws: ExcelJS.Worksheet, values: string[]) {
  const row = ws.addRow(values);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
}

function companyLabel(company: string | null) {
  return company ?? "Semua perusahaan";
}

export async function trialBalanceXlsx(data: Awaited<ReturnType<typeof trialBalance>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(
    wb,
    "Neraca Saldo",
    "NERACA SALDO",
    `${data.filter.from} s/d ${data.filter.to} · ${companyLabel(data.filter.company)}`
  );
  ws.columns = [{ width: 10 }, { width: 42 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  headerRow(ws, ["Kode", "Nama Akun", "Kelompok", "Saldo Awal (D-K)", "Debit", "Kredit", "Saldo Akhir (D-K)"]);
  for (const r of data.rows) {
    ws.addRow([r.code, r.name, r.group, r.opening, r.debit, r.credit, r.closing]);
  }
  const total = ws.addRow(["", "TOTAL", "", data.totals.opening, data.totals.debit, data.totals.credit, data.totals.closing]);
  total.font = { bold: true };
  [4, 5, 6, 7].forEach((c) => (ws.getColumn(c).numFmt = MONEY));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function sectionRows(ws: ExcelJS.Worksheet, sections: { label: string; rows: { code: string; name: string; amount: number }[]; total: number }[]) {
  for (const s of sections) {
    if (s.rows.length === 0) continue;
    ws.addRow([s.label]).font = { bold: true };
    for (const r of s.rows) ws.addRow([r.code, r.name, r.amount]);
    const t = ws.addRow(["", `Total ${s.label}`, s.total]);
    t.font = { bold: true };
    ws.addRow([]);
  }
}

export async function profitLossXlsx(data: Awaited<ReturnType<typeof profitLoss>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(
    wb,
    "Laba Rugi",
    "LAPORAN LABA RUGI",
    `${data.filter.from} s/d ${data.filter.to} · ${companyLabel(data.filter.company)}`
  );
  ws.columns = [{ width: 10 }, { width: 46 }, { width: 20 }];
  sectionRows(ws, data.sections);
  const s = data.summary;
  for (const [label, value] of [
    ["Laba Kotor", s.labaKotor],
    ["Total Beban Operasional", s.bebanOperasional],
    ["Laba Usaha", s.labaUsaha],
    ["Laba Bersih", s.labaBersih],
  ] as const) {
    ws.addRow(["", label, value]).font = { bold: true };
  }
  ws.getColumn(3).numFmt = MONEY;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function balanceSheetXlsx(data: Awaited<ReturnType<typeof balanceSheet>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(wb, "Neraca", "NERACA", `Per ${data.filter.asOf} · ${companyLabel(data.filter.company)}`);
  ws.columns = [{ width: 10 }, { width: 46 }, { width: 20 }];
  sectionRows(ws, data.sections);
  ws.addRow(["", "Laba (Rugi) Berjalan — belum ditutup", data.currentEarnings]);
  ws.addRow([]);
  ws.addRow(["", "TOTAL ASET", data.totals.assets]).font = { bold: true };
  ws.addRow(["", "TOTAL KEWAJIBAN + EKUITAS", data.totals.liabilitiesAndEquity]).font = { bold: true };
  ws.getColumn(3).numFmt = MONEY;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function generalLedgerXlsx(data: NonNullable<Awaited<ReturnType<typeof generalLedger>>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(
    wb,
    "Buku Besar",
    `BUKU BESAR ${data.account.code} — ${data.account.name}`,
    `${data.filter.from} s/d ${data.filter.to} · ${companyLabel(data.filter.company)}`
  );
  ws.columns = [{ width: 12 }, { width: 18 }, { width: 10 }, { width: 46 }, { width: 16 }, { width: 16 }, { width: 18 }];
  headerRow(ws, ["Tanggal", "No. Jurnal", "PT", "Keterangan", "Debit", "Kredit", "Saldo"]);
  ws.addRow(["", "", "", "Saldo awal", null, null, data.opening]);
  for (const r of data.rows) {
    ws.addRow([r.date.slice(0, 10), r.number, r.company, r.memo ? `${r.description} — ${r.memo}` : r.description, r.debit, r.credit, r.balance]);
  }
  ws.addRow(["", "", "", "TOTAL", data.totalDebit, data.totalCredit, data.closing]).font = { bold: true };
  [5, 6, 7].forEach((c) => (ws.getColumn(c).numFmt = MONEY));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function agingXlsx(data: Awaited<ReturnType<typeof receivableAging>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(wb, "Umur Piutang", "UMUR PIUTANG", `Per ${data.filter.asOf} · ${companyLabel(data.filter.company)}`);
  ws.columns = [{ width: 24 }, { width: 8 }, { width: 32 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 18 }, { width: 18 }];
  headerRow(ws, ["No. Invoice", "PT", "Klien", "Tanggal", "Jatuh Tempo", "Telat (hari)", "Nominal", "Kelompok Umur"]);
  const labels = new Map(AGING_BUCKETS.map((b) => [b.key, b.label]));
  for (const r of data.rows) {
    ws.addRow([r.invoiceNumber, r.company, r.customer, r.issueDate.slice(0, 10), r.dueDate.slice(0, 10), r.daysOverdue, r.amount, labels.get(r.bucket)]);
  }
  ws.addRow([]);
  for (const b of AGING_BUCKETS) ws.addRow(["", "", b.label, "", "", "", data.totals[b.key]]);
  ws.addRow(["", "", "TOTAL PIUTANG", "", "", "", data.total]).font = { bold: true };
  ws.addRow(["", "", "Saldo akun 110 Piutang Usaha", "", "", "", data.ledgerBalance]);
  ws.getColumn(7).numFmt = MONEY;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function cashFlowXlsx(data: Awaited<ReturnType<typeof cashFlow>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(
    wb,
    "Arus Kas",
    "LAPORAN ARUS KAS",
    `${data.filter.from} s/d ${data.filter.to} · ${companyLabel(data.filter.company)}`
  );
  ws.columns = [{ width: 10 }, { width: 46 }, { width: 20 }];
  ws.addRow(["", "Saldo kas & bank awal", data.opening]).font = { bold: true };
  ws.addRow([]);
  for (const s of data.sections) {
    ws.addRow([s.label]).font = { bold: true };
    for (const r of s.rows) ws.addRow([r.code, r.name, r.amount]);
    ws.addRow(["", `Kas bersih dari ${s.label.toLowerCase()}`, s.net]).font = { bold: true };
    ws.addRow([]);
  }
  ws.addRow(["", "Kenaikan (penurunan) kas", data.netChange]).font = { bold: true };
  ws.addRow(["", "Saldo kas & bank akhir", data.closing]).font = { bold: true };
  ws.getColumn(3).numFmt = MONEY;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function budgetXlsx(data: Awaited<ReturnType<typeof budgetVsActual>>) {
  const wb = new ExcelJS.Workbook();
  const ws = sheetWithTitle(
    wb,
    "Anggaran",
    "ANGGARAN VS REALISASI",
    `${data.filter.from} s/d ${data.filter.to} · ${companyLabel(data.filter.company)}`
  );
  ws.columns = [{ width: 10 }, { width: 42 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 10 }];
  for (const [label, block] of [
    ["PENDAPATAN", data.revenue],
    ["BEBAN", data.expense],
  ] as const) {
    ws.addRow([label]).font = { bold: true };
    headerRow(ws, ["Kode", "Nama Akun", "Anggaran", "Realisasi", "Selisih", "%"]);
    for (const r of block.rows) ws.addRow([r.code, r.name, r.budget, r.actual, r.variance, r.pct]);
    ws.addRow(["", `Total ${label.toLowerCase()}`, block.budget, block.actual, block.variance, block.pct]).font = { bold: true };
    ws.addRow([]);
  }
  ws.addRow(["", "Laba bersih", data.net.budget, data.net.actual]).font = { bold: true };
  [3, 4, 5].forEach((c) => (ws.getColumn(c).numFmt = MONEY));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
