import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { formatPeriodLabel, getPeriodRange } from "@/lib/period";
import { summarizeCashFlow } from "@/lib/finance";
import { formatRupiah } from "@/lib/payroll-policy";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const company = searchParams.get("company")?.toUpperCase() ?? undefined;
  const format = searchParams.get("format");

  const { start, end } = getPeriodRange(year, month);
  const periodLabel = formatPeriodLabel(year, month);

  const incomes = await prisma.incomeEntry.findMany({
    where: {
      entryDate: { gte: start, lte: end },
      ...(company ? { company } : {}),
    },
    orderBy: { entryDate: "desc" },
  });

  const fundExpenses = await prisma.fundRequest.findMany({
    where: {
      status: "REALIZED",
      realizedAt: { gte: start, lte: end },
      ...(company ? { company } : {}),
    },
    orderBy: { realizedAt: "desc" },
  });

  const payrollExpenses = await prisma.payrollPosting.findMany({
    where: {
      year,
      month,
      ...(company ? { company } : {}),
    },
  });

  const posTransactions = await prisma.posTransaction.findMany({
    where: {
      transactionDate: { gte: start, lte: end },
      ...(company ? { company } : {}),
    },
    orderBy: { transactionDate: "desc" },
  });

  const posSales = posTransactions.filter((t) => t.type === "SALE").reduce((s, t) => s + t.amount, 0);
  const posExpenseTotal = posTransactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  const expenseLines: { category: string; amount: number }[] = [];

  for (const f of fundExpenses) {
    expenseLines.push({ category: `Dana: ${f.company}`, amount: f.realizedAmount ?? f.totalAmount });
  }
  for (const p of payrollExpenses) {
    expenseLines.push({ category: `Payroll: ${p.company}`, amount: p.totalAmount });
  }
  if (posExpenseTotal > 0) {
    expenseLines.push({ category: `POS: ${company ?? "LBB"}`, amount: posExpenseTotal });
  }

  const summary = summarizeCashFlow({
    year,
    month,
    periodLabel,
    incomes: incomes.map((i) => ({ source: i.source, amount: i.amount })),
    expenses: expenseLines,
    posSales,
    posExpenses: posExpenseTotal,
  });

  if (format === "pdf") {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SuperApps BCI — Laporan Cash Flow", 14, 16);
    doc.setFontSize(10);
    doc.text(periodLabel, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [["Metrik", "Nilai"]],
      body: [
        ["Total Pendapatan", formatRupiah(summary.totalIncome)],
        ["Total Pengeluaran", formatRupiah(summary.totalExpense)],
        ["Net Cash Flow", formatRupiah(summary.netCashFlow)],
        ["Laba POS (penjualan - pengeluaran POS)", formatRupiah(summary.posProfit)],
      ],
      styles: { fontSize: 9 },
    });

    const y1 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;
    autoTable(doc, {
      startY: y1 + 8,
      head: [["Pendapatan per Sumber", "Nominal"]],
      body: summary.incomeBreakdown.map((r) => [r.source, formatRupiah(r.amount)]),
      styles: { fontSize: 8 },
    });

    const y2 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y1;
    autoTable(doc, {
      startY: y2 + 8,
      head: [["Pengeluaran per Kategori", "Nominal"]],
      body: summary.expenseBreakdown.map((r) => [r.category, formatRupiah(r.amount)]),
      styles: { fontSize: 8 },
    });

    await prisma.syncLog.create({
      data: {
        type: "PDF_ARCHIVE",
        status: "SUCCESS",
        message: `Cash flow PDF ${periodLabel}`,
      },
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cashflow-${year}-${month}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    year,
    month,
    periodLabel,
    summary,
    incomes,
    fundExpenses,
    payrollExpenses,
    posTransactions,
  });
}
