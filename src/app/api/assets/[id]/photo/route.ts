import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { deleteAssetPhoto, saveAssetPhoto } from "@/lib/asset-photo";

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
  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true, photoPath: true } });
  if (!asset) return NextResponse.json({ error: "Aset tidak ditemukan" }, { status: 404 });

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Pilih file foto" }, { status: 400 });
  }

  try {
    const filename = await saveAssetPhoto(id, photo);
    const updated = await prisma.asset.update({
      where: { id },
      data: { photoPath: filename },
      include: { user: { select: { name: true } } },
    });
    if (asset.photoPath && asset.photoPath !== filename) {
      await deleteAssetPhoto(asset.photoPath);
    }
    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "UPDATE",
      entity: "Asset",
      entityId: id,
      details: "foto",
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan foto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
