import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { deletePosTransaction, importPosTransaction, parsePosAccounts, syncPosDerived } from "@/lib/pos";
import { journalErrorResponse } from "@/lib/accounting/http";

const OUTLET_LOCKED = "Data dari POS outlet hanya bisa diubah atau di-void di aplikasi POS";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const company = params.get("company")?.toUpperCase() || undefined;
  const outletParam = params.get("outlet")?.toUpperCase() || undefined;
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));
  const hasPeriod = Number.isInteger(year) && year > 2000 && Number.isInteger(month) && month >= 1 && month <= 12;

  const where = {
    ...(company ? { company } : {}),
    ...(outletParam ? { outlet: outletParam === "MANUAL" ? null : outletParam } : {}),
    ...(hasPeriod
      ? { transactionDate: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : {}),
  };

  const [transactions, totals, outletRows] = await Promise.all([
    prisma.posTransaction.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { outlet: "asc" }],
      take: hasPeriod ? 1000 : 100,
    }),
    prisma.posTransaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
    prisma.posTransaction.findMany({ where: { outlet: { not: null } }, distinct: ["outlet"], select: { outlet: true } }),
  ]);

  const sales = totals.find((t) => t.type === "SALE")?._sum.amount ?? 0;
  const expenses = totals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0;
  const outlets = outletRows.map((r) => r.outlet!).sort();

  return NextResponse.json({ transactions, sales, expenses, profit: sales - expenses, outlets });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const result = await importPosTransaction(body, session.nik);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body.id ?? "").trim();
  const type = body.type === "EXPENSE" ? "EXPENSE" : body.type === "SALE" ? "SALE" : null;
  const amount = Number(body.amount);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const transactionDate = body.transactionDate as string | undefined;

  if (!id || !type || !(amount > 0) || !transactionDate) {
    return NextResponse.json({ error: "Tipe, nominal, dan tanggal wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.posTransaction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  if (existing.outlet) return NextResponse.json({ error: OUTLET_LOCKED }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const accounts = await parsePosAccounts(tx, type, body);
      const row = await tx.posTransaction.update({
        where: { id },
        data: {
          type,
          amount,
          description: description || null,
          transactionDate: new Date(transactionDate),
          ...("accountCode" in body ? { accountCode: accounts.accountCode } : {}),
          ...("cashAccount" in body ? { cashAccount: accounts.cashAccount } : {}),
        },
      });
      await syncPosDerived(tx, id, session.nik);
      return row;
    });
    return NextResponse.json(updated);
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const existing = await prisma.posTransaction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  if (existing.outlet) return NextResponse.json({ error: OUTLET_LOCKED }, { status: 400 });

  await prisma.$transaction((tx) => deletePosTransaction(tx, id));
  return NextResponse.json({ ok: true });
}
