import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { FIXED_ASSET_ACCOUNTS } from "@/lib/accounting/constants";

type Ctx = { params: Promise<{ id: string }> };

/** Data aset tetap untuk penyusutan; field kosong = hapus dari daftar penyusutan. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const company = typeof body.company === "string" ? body.company.trim().toUpperCase() : "";
  const assetAccount = typeof body.assetAccount === "string" ? body.assetAccount.trim() : "";
  const cost = Number(body.acquisitionCost);
  const life = Number(body.usefulLifeMonths);
  const residual = Number(body.residualValue) || 0;
  const dateRaw = typeof body.acquisitionDate === "string" ? body.acquisitionDate : "";

  if (!assetAccount && !(cost > 0)) {
    await prisma.asset.update({
      where: { id },
      data: { company: null, acquisitionCost: null, acquisitionDate: null, usefulLifeMonths: null, residualValue: 0, assetAccount: null },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!company) return NextResponse.json({ error: "Pilih perusahaan pemilik aset" }, { status: 400 });
  if (!FIXED_ASSET_ACCOUNTS.includes(assetAccount)) {
    return NextResponse.json({ error: "Pilih akun aset tetap (131–141 / 164–167)" }, { status: 400 });
  }
  if (!(cost > 0)) return NextResponse.json({ error: "Harga perolehan wajib > 0" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return NextResponse.json({ error: "Tanggal perolehan wajib" }, { status: 400 });
  if (!Number.isInteger(life) || life < 1 || life > 600) {
    return NextResponse.json({ error: "Umur ekonomis 1–600 bulan" }, { status: 400 });
  }
  if (residual < 0 || residual >= cost) {
    return NextResponse.json({ error: "Nilai sisa harus ≥ 0 dan lebih kecil dari harga perolehan" }, { status: 400 });
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      company,
      assetAccount,
      acquisitionCost: cost,
      acquisitionDate: new Date(`${dateRaw}T12:00:00+07:00`),
      usefulLifeMonths: life,
      residualValue: residual,
    },
  });
  return NextResponse.json(asset);
}
