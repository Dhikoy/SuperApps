import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { saveSignedTransfer } from "@/lib/asset-transfer-file";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const transfer = await prisma.assetTransfer.findUnique({ where: { id } });
  if (!transfer) return NextResponse.json({ error: "Form tidak ditemukan" }, { status: 404 });
  if (transfer.status !== "pending") {
    return NextResponse.json({ error: "Form ini sudah selesai" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pilih file form yang sudah ditandatangani" }, { status: 400 });
  }

  try {
    const signedPath = await saveSignedTransfer(id, file);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.assetTransfer.update({
        where: { id },
        data: { status: "completed", signedPath, completedAt: new Date() },
      });
      await tx.asset.update({
        where: { id: transfer.assetId },
        data: {
          userId: transfer.toUserId,
          warehouse: transfer.toLocation,
          condition: transfer.condition,
        },
      });
      return row;
    });

    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "UPDATE",
      entity: "Asset",
      entityId: transfer.assetId,
      details: `pindah ke ${transfer.toLocation}`,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengunggah form";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
