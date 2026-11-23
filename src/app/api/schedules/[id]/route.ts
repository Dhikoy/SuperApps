import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "schedules:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { shiftName, standardClockIn, standardClockOut, isActive } = await request.json();

  const schedule = await prisma.workSchedule.update({
    where: { id },
    data: {
      ...(shiftName !== undefined && { shiftName }),
      ...(standardClockIn !== undefined && { standardClockIn }),
      ...(standardClockOut !== undefined && { standardClockOut }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(schedule);
}
