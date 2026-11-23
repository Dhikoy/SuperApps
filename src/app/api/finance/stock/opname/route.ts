import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFundRequestFromStockAlert, detectStockAlerts } from "@/lib/stock";
import { canManageStock, requireHrApi } from "@/lib/hr-auth";

export async function POST(request: NextRequest) {
  const auth = await requireHrApi(["finance:submit", "stock:manage"]);
  if (auth.error) return auth.error;
  if (!canManageStock(auth.session!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = auth.session!;

  const { stockItemId, countedQty, note } = await request.json();

  if (!stockItemId || countedQty === undefined) {
    return NextResponse.json({ error: "stockItemId dan countedQty wajib" }, { status: 400 });
  }

  const item = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

  const qty = Number(countedQty);

  const opname = await prisma.$transaction(async (tx) => {
    const record = await tx.stockOpname.create({
      data: {
        stockItemId,
        countedQty: qty,
        countedBy: session.nik,
        note: note?.trim() || null,
      },
    });

    await tx.stockItem.update({
      where: { id: stockItemId },
      data: { currentQty: qty },
    });

    return record;
  });

  const updated = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  const alerts = updated ? detectStockAlerts([updated]) : [];

  return NextResponse.json({ opname, alerts }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireHrApi(["finance:submit", "stock:manage"]);
  if (auth.error) return auth.error;
  if (!canManageStock(auth.session!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = auth.session!;

  const { stockItemId, unitPrice } = await request.json();
  if (!stockItemId || !unitPrice) {
    return NextResponse.json({ error: "stockItemId dan unitPrice wajib" }, { status: 400 });
  }

  const item = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

  const alerts = detectStockAlerts([item]);
  const alert = alerts[0];
  if (!alert) {
    return NextResponse.json({ error: "Stok mencukupi, tidak perlu pengajuan" }, { status: 400 });
  }

  const fundRequest = await createFundRequestFromStockAlert(alert, session.nik, Number(unitPrice));
  return NextResponse.json(fundRequest, { status: 201 });
}
