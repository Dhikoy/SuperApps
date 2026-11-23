import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { getJakartaTodayStart } from "@/lib/timezone";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission(session.role, "attendance:clock")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = getJakartaTodayStart();
    const record = await prisma.attendance.findFirst({
      where: { userId: session.id, date: today },
      select: {
        id: true,
        clockInTime: true,
        clockOutTime: true,
        status: true,
        jamKerja: { select: { shiftName: true, standardClockIn: true, standardClockOut: true } },
      },
    });

    return NextResponse.json({ today: record });
  } catch (err) {
    console.error("[GET /api/attendance/today]", err);
    return NextResponse.json({ error: "Gagal memuat status presensi hari ini" }, { status: 500 });
  }
}
