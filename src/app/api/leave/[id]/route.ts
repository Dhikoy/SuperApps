import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requiresAtasanApproval } from "@/lib/leave";
import { canApproveAsAtasan, canApproveAsHrd } from "@/lib/leave-approval";
import { syncApprovedLeaveToAttendance } from "@/lib/leave-attendance-sync";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyLeaveApproved } from "@/lib/notify";
import { notifyLeaveDecided, notifyLeaveNeedsHrd } from "@/lib/telegram/notify";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { nik: true, name: true, supervisorId: true } } },
  });

  if (!leave) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
  if (leave.approvalStatus === "APPROVED" || leave.approvalStatus === "REJECTED") {
    return NextResponse.json({ error: "Pengajuan sudah final" }, { status: 400 });
  }

  if (action === "reject") {
    const canReject =
      (leave.approvalStatus === "PENDING" &&
        (await canApproveAsAtasan(session.id, session.role, leave.userId))) ||
      (leave.approvalStatus === "ATASAN_APPROVED" && canApproveAsHrd(session.role)) ||
      (leave.approvalStatus === "PENDING" &&
        !(await requiresAtasanApproval(leave.leaveType)) &&
        canApproveAsHrd(session.role));

    if (!canReject) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { approvalStatus: "REJECTED" },
      include: { user: { select: { name: true } } },
    });
    await writeAuditLog({
      actorId: session.id,
      actorName: session.name,
      action: "REJECT",
      entity: "LeaveRequest",
      entityId: id,
      details: leave.leaveType,
    });
    void notifyLeaveDecided({ userId: leave.userId, leaveType: leave.leaveType, approved: false });
    return NextResponse.json(updated);
  }

  const needsAtasan = await requiresAtasanApproval(leave.leaveType);

  if (needsAtasan && leave.approvalStatus === "PENDING") {
    if (!(await canApproveAsAtasan(session.id, session.role, leave.userId))) {
      return NextResponse.json({ error: "Hanya atasan yang dapat menyetujui tahap ini" }, { status: 403 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        approvalStatus: "ATASAN_APPROVED",
        atasanApprovedBy: session.id,
        atasanApprovedAt: new Date(),
      },
      include: { user: { select: { name: true } } },
    });
    void notifyLeaveDecided({
      userId: leave.userId,
      leaveType: leave.leaveType,
      approved: true,
      stage: "atasan",
    });
    void notifyLeaveNeedsHrd({
      id: leave.id,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      userName: leave.user.name,
      atasanName: session.name,
    });
    return NextResponse.json(updated);
  }

  const readyForHrd =
    (needsAtasan && leave.approvalStatus === "ATASAN_APPROVED") ||
    (!needsAtasan && leave.approvalStatus === "PENDING");

  if (readyForHrd) {
    if (!canApproveAsHrd(session.role)) {
      return NextResponse.json({ error: "Hanya HRD yang dapat menyetujui tahap final" }, { status: 403 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        approvalStatus: "APPROVED",
        hrdApprovedBy: session.id,
        hrdApprovedAt: new Date(),
        approvedBy: session.id,
        approvedAt: new Date(),
      },
      include: { user: { select: { name: true } } },
    });
    await syncApprovedLeaveToAttendance(id);
    await writeAuditLog({
      actorId: session.id,
      actorName: session.name,
      action: "APPROVE",
      entity: "LeaveRequest",
      entityId: id,
      details: `${leave.leaveType} → presensi IZIN`,
    });
    void notifyLeaveApproved(updated.user.name, leave.leaveType);
    void notifyLeaveDecided({ userId: leave.userId, leaveType: leave.leaveType, approved: true });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Status pengajuan tidak valid untuk disetujui" }, { status: 400 });
}
