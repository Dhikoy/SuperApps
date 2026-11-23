import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { assetLoanInclude } from "@/lib/asset-loan";

/** Barang dikembalikan → kembali ke gudang asal (atau Kantor) bila masih tercatat di peminjam. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const note = String(body.note ?? "").trim().slice(0, 300) || null;

  const loan = await prisma.assetLoan.findUnique({ where: { id }, include: assetLoanInclude });
  if (!loan) return NextResponse.json({ error: "Form peminjaman tidak ditemukan" }, { status: 404 });
  if (loan.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hanya peminjaman berstatus Dipinjam yang bisa dikembalikan" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of loan.items) {
      const asset = await tx.asset.findUnique({ where: { id: item.assetId }, select: { userId: true } });
      if (!asset || asset.userId !== loan.borrowerId) continue;
      await tx.asset.update({
        where: { id: item.assetId },
        data: {
          userId: null,
          warehouse: !item.previousUserId && item.previousWarehouse ? item.previousWarehouse : "Kantor",
        },
      });
    }
    return tx.assetLoan.update({
      where: { id },
      data: { status: "RETURNED", returnedAt: new Date(), returnedBy: session.name, returnNote: note },
      include: assetLoanInclude,
    });
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "UPDATE",
    entity: "AssetLoan",
    entityId: id,
    details: `${loan.number} barang dikembalikan oleh ${loan.borrowerName}`,
  });
  return NextResponse.json(updated);
}
