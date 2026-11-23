import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageHrSettings } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHrSettings(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const office = await prisma.officeLocation.update({
    where: { id },
    data: {
      ...(body.name != null ? { name: String(body.name).trim() } : {}),
      ...(body.address != null ? { address: body.address?.trim() || null } : {}),
      ...(body.latitude != null ? { latitude: Number(body.latitude) } : {}),
      ...(body.longitude != null ? { longitude: Number(body.longitude) } : {}),
      ...(body.radiusMeters != null ? { radiusMeters: Number(body.radiusMeters) } : {}),
      ...(body.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
    },
  });
  return NextResponse.json(office);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHrSettings(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const permanent = request.nextUrl.searchParams.get("permanent") === "1";

  const existing = await prisma.officeLocation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lokasi tidak ditemukan" }, { status: 404 });
  }

  if (permanent) {
    if (existing.isActive) {
      return NextResponse.json(
        { error: "Nonaktifkan lokasi terlebih dahulu sebelum menghapus permanen" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.user.updateMany({ where: { officeLocationId: id }, data: { officeLocationId: null } }),
      prisma.companyPresensiConfig.updateMany({
        where: { officeLocationId: id },
        data: { officeLocationId: null },
      }),
      prisma.officeLocation.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true, deleted: true });
  }

  await prisma.officeLocation.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
