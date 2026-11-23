import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isActiveLeaveType } from "@/lib/leave-types";
import { hasPermission } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where =
    hasPermission(session.role, "leave:manage") ||
    hasPermission(session.role, "leave:approve_atasan") ||
    hasPermission(session.role, "leave:approve_hrd")
      ? {}
      : { userId: session.id };

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: { user: { select: { name: true, userId: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "leave:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { leaveType, startDate, endDate, remarks } = await request.json();

  if (!leaveType?.trim()) {
    return NextResponse.json({ error: "Jenis cuti wajib dipilih" }, { status: 400 });
  }

  if (!(await isActiveLeaveType(String(leaveType).trim()))) {
    return NextResponse.json({ error: "Jenis cuti tidak valid atau sudah dinonaktifkan" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      userId: session.id,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      remarks,
    },
  });

  void import("@/lib/leave").then(async ({ requiresAtasanApproval }) => {
    const needsAtasan = await requiresAtasanApproval(leave.leaveType);
    const { notifyLeaveSubmitted } = await import("@/lib/telegram/notify");
    await notifyLeaveSubmitted({
      id: leave.id,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      userId: leave.userId,
      needsAtasan,
    });
  });

  return NextResponse.json(leave, { status: 201 });
}
