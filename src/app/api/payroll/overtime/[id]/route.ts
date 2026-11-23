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
  if (!hasPermission(session.role, "payroll:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { approvalStatus } = await request.json();

  if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const overtime = await prisma.overtime.update({
    where: { id },
    data: {
      approvalStatus,
      approvedBy: session.nik,
      approvedAt: new Date(),
    },
    include: { user: { select: { name: true, userId: true, company: true } } },
  });

  void import("@/lib/telegram/notify").then(({ notifyOvertimeDecided }) =>
    notifyOvertimeDecided({
      userId: overtime.userId,
      approved: approvalStatus === "APPROVED",
      hours: overtime.hours,
      date: overtime.date,
    })
  );

  return NextResponse.json(overtime);
}
