import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { formatPeriodLabel, getPeriodRange } from "@/lib/period";
import { buildGoogleSyncPayload, pushToGoogleWebhook } from "@/lib/google-sync";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { year, month } = await request.json();
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const periodLabel = formatPeriodLabel(y, m);
  const { start, end } = getPeriodRange(y, m);

  const [incomes, fundExpenses, payrollExpenses, posTx] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { entryDate: { gte: start, lte: end } } }),
    prisma.fundRequest.findMany({ where: { status: "REALIZED", realizedAt: { gte: start, lte: end } } }),
    prisma.payrollPosting.findMany({ where: { year: y, month: m } }),
    prisma.posTransaction.findMany({ where: { transactionDate: { gte: start, lte: end } } }),
  ]);

  const payload = buildGoogleSyncPayload({
    type: "CASHFLOW",
    periodLabel,
    year: y,
    month: m,
    data: {
      incomes,
      fundExpenses,
      payrollExpenses,
      posTransactions: posTx,
      totalIncome: incomes.reduce((s, i) => s + i.amount, 0),
      totalExpense:
        fundExpenses.reduce((s, e) => s + (e.realizedAmount ?? e.totalAmount), 0) +
        payrollExpenses.reduce((s, e) => s + e.totalAmount, 0) +
        posTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0),
    },
  });

  const result = await pushToGoogleWebhook(payload);

  await prisma.syncLog.create({
    data: {
      type: "GOOGLE_SHEETS",
      status: result.ok ? "SUCCESS" : "FAILED",
      message: result.message,
      payload: JSON.stringify(payload),
    },
  });

  return NextResponse.json({ ...result, payload });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.syncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    logs,
    webhookConfigured: Boolean(process.env.GOOGLE_SYNC_WEBHOOK_URL),
  });
}
