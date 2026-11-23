import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission } from "@/lib/roles";
import { ensureCoaSeeded } from "@/lib/accounting/journal";
import { defaultNormalBalance, groupForCode } from "@/lib/accounting/coa-data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyPermission(session.role, ["finance:view", "finance:submit", "payroll:manage"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureCoaSeeded();
  const [accounts, usage] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({ by: ["accountCode"], _count: { _all: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.accountCode, u._count._all]));

  return NextResponse.json(
    accounts.map((a) => ({
      code: a.code,
      name: a.name,
      group: a.group,
      isHeader: a.isHeader,
      normalBalance: a.normalBalance,
      isCash: a.isCash,
      active: a.active,
      lineCount: used.get(a.code) ?? 0,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!/^[1-5]\d{2,5}$/.test(code)) {
    return NextResponse.json({ error: "Kode akun 3–6 digit, diawali 1–5 sesuai kelompok" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Nama akun wajib diisi" }, { status: 400 });

  await ensureCoaSeeded();
  if (await prisma.account.findUnique({ where: { code } })) {
    return NextResponse.json({ error: `Kode ${code} sudah dipakai` }, { status: 400 });
  }

  const group = groupForCode(code);
  const account = await prisma.account.create({
    data: {
      code,
      name,
      group,
      isHeader: Boolean(body.isHeader),
      normalBalance: body.normalBalance === "DEBIT" || body.normalBalance === "CREDIT" ? body.normalBalance : defaultNormalBalance(group),
      isCash: group === "ASSET" && Boolean(body.isCash),
    },
  });
  return NextResponse.json(account, { status: 201 });
}
