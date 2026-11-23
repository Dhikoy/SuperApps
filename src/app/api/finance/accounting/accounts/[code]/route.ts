import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ code: string }> };

async function guard() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return denied;

  const { code } = await ctx.params;
  const account = await prisma.account.findUnique({ where: { code } });
  if (!account) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : account.name;
  if (!name) return NextResponse.json({ error: "Nama akun wajib diisi" }, { status: 400 });

  const isHeader = typeof body.isHeader === "boolean" ? body.isHeader : account.isHeader;
  if (isHeader && !account.isHeader) {
    const used = await prisma.journalLine.count({ where: { accountCode: code } });
    if (used > 0) {
      return NextResponse.json({ error: "Akun sudah dipakai di jurnal, tidak bisa dijadikan akun induk" }, { status: 400 });
    }
  }

  const updated = await prisma.account.update({
    where: { code },
    data: {
      name,
      isHeader,
      active: typeof body.active === "boolean" ? body.active : account.active,
      isCash: account.group === "ASSET" && (typeof body.isCash === "boolean" ? body.isCash : account.isCash),
      normalBalance:
        body.normalBalance === "DEBIT" || body.normalBalance === "CREDIT" ? body.normalBalance : account.normalBalance,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return denied;

  const { code } = await ctx.params;
  const used = await prisma.journalLine.count({ where: { accountCode: code } });
  if (used > 0) {
    return NextResponse.json(
      { error: "Akun sudah dipakai di jurnal — nonaktifkan saja, jangan dihapus" },
      { status: 400 }
    );
  }
  await prisma.account.deleteMany({ where: { code } });
  return NextResponse.json({ ok: true });
}
