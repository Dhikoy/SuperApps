import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission(session.role, "schedules:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const canManage = hasPermission(session.role, "schedules:manage");
    const schedules = await prisma.workSchedule.findMany({
      where: canManage ? {} : { isActive: true },
      orderBy: { shiftName: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (err) {
    console.error("[GET /api/schedules]", err);
    return NextResponse.json({ error: "Gagal memuat jadwal kerja" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "schedules:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shiftName, standardClockIn, standardClockOut, isActive } = await request.json();

  if (!shiftName || !standardClockIn || !standardClockOut) {
    return NextResponse.json({ error: "Data jadwal tidak lengkap" }, { status: 400 });
  }

  const schedule = await prisma.workSchedule.create({
    data: {
      shiftName,
      standardClockIn,
      standardClockOut,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(schedule, { status: 201 });
}
