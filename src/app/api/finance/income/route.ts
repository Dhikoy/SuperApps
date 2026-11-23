import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { journalErrorResponse } from "@/lib/accounting/http";
import { assertAccount, deleteSourceJournal, syncIncomeJournal, type Db } from "@/lib/accounting/journal";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = request.nextUrl.searchParams.get("company")?.toUpperCase() ?? undefined;

  const entries = await prisma.incomeEntry.findMany({
    where: company ? { company } : {},
    orderBy: { entryDate: "desc" },
    take: 50,
  });

  return NextResponse.json(entries);
}

async function parseIncomeAccounts(db: Db, body: { accountCode?: unknown; cashAccount?: unknown }) {
  const accountCode = await assertAccount(db, typeof body.accountCode === "string" ? body.accountCode : null, {
    label: "Akun pendapatan",
    groups: ["REVENUE"],
  });
  const cashAccount = await assertAccount(db, typeof body.cashAccount === "string" ? body.cashAccount : null, {
    label: "Masuk ke",
    cash: true,
  });
  return { accountCode, cashAccount };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, company, amount, entryDate, remarks } = body;

  if (!title?.trim() || !company?.trim() || !amount || amount <= 0 || !entryDate) {
    return NextResponse.json({ error: "Judul, perusahaan, nominal, dan tanggal wajib diisi" }, { status: 400 });
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const accounts = await parseIncomeAccounts(tx, body);
      const row = await tx.incomeEntry.create({
        data: {
          title: title.trim(),
          company: company.toUpperCase(),
          amount: Number(amount),
          source: "MANUAL",
          entryDate: new Date(entryDate),
          remarks: remarks?.trim() || null,
          createdBy: session.nik,
          ...accounts,
        },
      });
      await syncIncomeJournal(tx, row.id);
      return row;
    });
    return NextResponse.json(entry, { status: 201 });
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
  const title = String(body.title ?? "").trim();
  const company = String(body.company ?? "").trim().toUpperCase();
  const amount = Number(body.amount);
  const entryDate = body.entryDate as string | undefined;
  const remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";

  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  if (!title || !company || !(amount > 0) || !entryDate) {
    return NextResponse.json({ error: "Judul, perusahaan, nominal, dan tanggal wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.incomeEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pendapatan tidak ditemukan" }, { status: 404 });

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const accounts = await parseIncomeAccounts(tx, body);
      const row = await tx.incomeEntry.update({
        where: { id },
        data: {
          title,
          company,
          amount,
          entryDate: new Date(entryDate),
          remarks: remarks || null,
          ...("accountCode" in body ? { accountCode: accounts.accountCode } : {}),
          ...("cashAccount" in body ? { cashAccount: accounts.cashAccount } : {}),
        },
      });
      await syncIncomeJournal(tx, id);
      return row;
    });
    return NextResponse.json(entry);
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

  const existing = await prisma.incomeEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pendapatan tidak ditemukan" }, { status: 404 });
  if (existing.posTransactionId) {
    return NextResponse.json(
      { error: "Pendapatan ini dari transaksi POS — hapus lewat menu POS LBB" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await deleteSourceJournal(tx, "INCOME", id);
      await tx.invoice.updateMany({
        where: { syncedIncomeId: id },
        data: { syncedIncomeId: null, syncedAt: null, status: "ISSUED" },
      });
      await tx.incomeEntry.delete({ where: { id } });
    });
  } catch (error) {
    return journalErrorResponse(error);
  }

  return NextResponse.json({ ok: true });
}
