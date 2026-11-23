import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const outlet = params.get("outlet")?.toUpperCase() || undefined;
  const status = params.get("status")?.toUpperCase();
  const q = params.get("q")?.trim();
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));
  const hasPeriod = Number.isInteger(year) && year > 2000 && Number.isInteger(month) && month >= 1 && month <= 12;
  const prefix = hasPeriod ? `${year}-${String(month).padStart(2, "0")}-` : undefined;

  const base = {
    ...(outlet ? { outlet } : {}),
    ...(prefix ? { saleDate: { startsWith: prefix } } : {}),
    ...(q ? { OR: [{ invoiceNo: { contains: q } }, { items: { contains: q } }, { cashier: { contains: q } }] } : {}),
  };
  const where = { ...base, ...(status === "VOID" || status === "COMPLETED" || status === "PENDING" ? { status } : {}) };

  const [sales, summary] = await Promise.all([
    prisma.posSale.findMany({ where, orderBy: { occurredAt: "desc" }, take: 2000 }),
    prisma.posSale.groupBy({ by: ["status"], where: base, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  const pick = (s: string) => summary.find((r) => r.status === s);
  return NextResponse.json({
    sales,
    completed: { count: pick("COMPLETED")?._count._all ?? 0, amount: pick("COMPLETED")?._sum.amount ?? 0 },
    pending: { count: pick("PENDING")?._count._all ?? 0, amount: pick("PENDING")?._sum.amount ?? 0 },
    voided: { count: pick("VOID")?._count._all ?? 0, amount: pick("VOID")?._sum.amount ?? 0 },
  });
}
