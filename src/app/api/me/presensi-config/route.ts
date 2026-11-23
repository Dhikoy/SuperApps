import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { hasApprovedBusinessTripToday, resolvePresensiForUser } from "@/lib/resolve-presensi";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "attendance:clock")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { nik: session.nik },
    select: {
      company: true,
      officeLocationId: true,
      workScheduleId: true,
      officeLocation: true,
      workSchedule: true,
      flexibleAttendance: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const [config, onBusinessTrip] = await Promise.all([
    resolvePresensiForUser(user),
    hasApprovedBusinessTripToday(session.nik),
  ]);

  return NextResponse.json({
    company: user.company,
    flexibleAttendance: user.flexibleAttendance,
    onBusinessTrip,
    ...config,
  });
}
