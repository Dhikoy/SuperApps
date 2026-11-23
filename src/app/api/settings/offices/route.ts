import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageHrSettings } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHrSettings(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const offices = await prisma.officeLocation.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(offices);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHrSettings(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, address, latitude, longitude, radiusMeters } = await request.json();
  if (!name || latitude == null || longitude == null) {
    return NextResponse.json({ error: "Nama dan koordinat wajib diisi" }, { status: 400 });
  }

  const office = await prisma.officeLocation.create({
    data: {
      name: String(name).trim(),
      address: address?.trim() || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusMeters: radiusMeters ?? 100,
    },
  });
  return NextResponse.json(office, { status: 201 });
}
