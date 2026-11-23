import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { getCalendarMonthRange } from "@/lib/period";
import { getJakartaTodayEnd } from "@/lib/timezone";
import { dedupeAttendanceRows } from "@/lib/attendance-dedupe";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const userId = searchParams.get("userId");

  const canManage = hasPermission(session.role, "attendance:manage");
  const canView = hasPermission(session.role, "attendance:view");

  if (!canManage && !canView && !hasPermission(session.role, "attendance:clock")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUserId = canManage && userId ? userId : session.id;
  if (targetUserId !== session.id && !canManage && !canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { start, end: monthEnd } = getCalendarMonthRange(year, month);
  const todayEnd = getJakartaTodayEnd();
  const end = monthEnd.getTime() > todayEnd.getTime() ? todayEnd : monthEnd;

  const attendances = dedupeAttendanceRows(
    await prisma.attendance.findMany({
      where: {
        userId: targetUserId,
        date: { gte: start, lte: end },
      },
      include: {
        user: { select: { nik: true, name: true, userId: true } },
        jamKerja: { select: { shiftName: true, standardClockIn: true } },
      },
      orderBy: { date: "desc" },
    })
  );

  return NextResponse.json({
    year,
    month,
    attendances,
    totalMasuk: attendances.filter((a) => a.clockInTime != null).length,
  });
}
