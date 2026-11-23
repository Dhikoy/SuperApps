import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { ensureCoaSeeded } from "@/lib/accounting/journal";

function parseYear(raw: unknown) {
  const y = Number(raw);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
}

/** GET ?year=2026&company=BCI → { accountCode: [12 nilai bulan] } */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const year = parseYear(params.get("year"));
  const company = (params.get("company") ?? "").trim().toUpperCase();
  if (!year || !company) return NextResponse.json({ error: "Tahun dan perusahaan wajib" }, { status: 400 });

  const rows = await prisma.budget.findMany({ where: { year, company } });
  const budgets: Record<string, number[]> = {};
  for (const r of rows) {
    budgets[r.accountCode] ??= Array(12).fill(0);
    budgets[r.accountCode][r.month - 1] = r.amount;
  }
  return NextResponse.json({ year, company, budgets });
}

/** PUT { year, company, budgets: { accountCode: [12 nilai] } } — mengganti seluruh anggaran tahun & perusahaan tsb. */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const year = parseYear(body.year);
  const company = String(body.company ?? "").trim().toUpperCase();
  if (!year || !company || company === "ALL") {
    return NextResponse.json({ error: "Pilih tahun dan satu perusahaan" }, { status: 400 });
  }
  const input = body.budgets && typeof body.budgets === "object" ? (body.budgets as Record<string, unknown>) : {};

  await ensureCoaSeeded();
  const accounts = await prisma.account.findMany({
    where: { code: { in: Object.keys(input) } },
    select: { code: true, name: true, group: true, isHeader: true },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));

  const data: { year: number; month: number; company: string; accountCode: string; amount: number; updatedBy: string }[] = [];
  for (const [code, months] of Object.entries(input)) {
    const acc = byCode.get(code);
    if (!acc) return NextResponse.json({ error: `Akun ${code} tidak ada di COA` }, { status: 400 });
    if (acc.isHeader || (acc.group !== "REVENUE" && acc.group !== "EXPENSE")) {
      return NextResponse.json({ error: `Akun ${code} ${acc.name} tidak bisa dianggarkan` }, { status: 400 });
    }
    if (!Array.isArray(months) || months.length !== 12) {
      return NextResponse.json({ error: `Anggaran akun ${code} harus 12 bulan` }, { status: 400 });
    }
    const amounts = months.map((value) => Math.round((Number(value) || 0) * 100) / 100);
    if (amounts.some((a) => a < 0)) {
      return NextResponse.json({ error: `Anggaran akun ${code} tidak boleh negatif` }, { status: 400 });
    }
    amounts.forEach((amount, idx) => {
      if (amount > 0) data.push({ year, month: idx + 1, company, accountCode: code, amount, updatedBy: session.nik });
    });
  }

  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { year, company } }),
    prisma.budget.createMany({ data }),
  ]);
  return NextResponse.json({ ok: true, saved: data.length });
}
