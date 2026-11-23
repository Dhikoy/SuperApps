import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectStockAlerts } from "@/lib/stock";
import { canManageStock, canViewStock, requireHrApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrApi(["finance:view", "stock:manage"]);
  if (auth.error) return auth.error;
  if (!canViewStock(auth.session!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.stockItem.findMany({
    include: {
      opnames: { orderBy: { countedAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const alerts = detectStockAlerts(items);

  return NextResponse.json({ items, alerts });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi(["finance:submit", "stock:manage"]);
  if (auth.error) return auth.error;
  if (!canManageStock(auth.session!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, company, unit, minQuantity, currentQty } = await request.json();

  if (!name?.trim() || !company?.trim()) {
    return NextResponse.json({ error: "Nama dan perusahaan wajib diisi" }, { status: 400 });
  }

  const item = await prisma.stockItem.create({
    data: {
      name: name.trim(),
      company: company.toUpperCase(),
      unit: unit?.trim() || "unit",
      minQuantity: Number(minQuantity) || 0,
      currentQty: Number(currentQty) || 0,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
