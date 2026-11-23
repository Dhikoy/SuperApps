import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const offices = await prisma.officeLocation.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        radiusMeters: true,
      },
    });
    return NextResponse.json(offices);
  } catch {
    return NextResponse.json([]);
  }
}
