import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { deleteAssetPhoto } from "@/lib/asset-photo";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(body.laptop !== undefined ? { laptop: String(body.laptop).trim() } : {}),
        ...(body.serialNumber !== undefined ? { serialNumber: String(body.serialNumber).trim() } : {}),
        ...(body.condition !== undefined ? { condition: String(body.condition).trim() } : {}),
        ...(body.warehouse !== undefined ? { warehouse: String(body.warehouse).trim() } : {}),
        ...(body.specification !== undefined
          ? { specification: String(body.specification).trim() || null }
          : {}),
        ...(body.category !== undefined ? { category: String(body.category).trim() || null } : {}),
        ...(body.usageNote !== undefined ? { usageNote: String(body.usageNote).trim() || null } : {}),
        ...(body.quantity !== undefined ? { quantity: Math.max(1, Number(body.quantity) || 1) } : {}),
        ...(body.userId !== undefined ? { userId: body.userId || null } : {}),
      },
      include: { user: { select: { name: true } } },
    });

    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "UPDATE",
      entity: "Asset",
      entityId: id,
    });

    return NextResponse.json(asset);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "Serial Number sudah dipakai aset lain" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.asset.findUnique({ where: { id }, select: { photoPath: true } });
  await prisma.asset.delete({ where: { id } });
  await deleteAssetPhoto(existing?.photoPath);

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "DELETE",
    entity: "Asset",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
