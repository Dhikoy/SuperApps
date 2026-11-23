import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { requiresAtasanApproval } from "@/lib/leave";
import { syncApprovedLeaveToAttendance } from "@/lib/leave-attendance-sync";
import { writeAuditLog } from "@/lib/audit-log";
import { canApproveAsAtasan, canApproveAsHrd } from "@/lib/leave-approval";
import {
  notifyFundDecided,
  notifyLeaveDecided,
  notifyLeaveNeedsHrd,
  notifyOvertimeDecided,
} from "@/lib/telegram/notify";

type Actor = { nik: string; name: string; role: Role; id: string };

export async function approveOvertimeViaTelegram(id: string, actor: Actor, approved: boolean) {
  if (!hasPermission(actor.role, "payroll:manage")) {
    return { ok: false, error: "Anda tidak punya akses approve lembur" };
  }

  const existing = await prisma.overtime.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Lembur tidak ditemukan" };
  if (existing.approvalStatus !== "PENDING") {
    return { ok: false, error: "Lembur sudah diproses" };
  }

  const overtime = await prisma.overtime.update({
    where: { id },
    data: {
      approvalStatus: approved ? "APPROVED" : "REJECTED",
      approvedBy: actor.nik,
      approvedAt: new Date(),
    },
  });

  void notifyOvertimeDecided({
    userId: overtime.userId,
    approved,
    hours: overtime.hours,
    date: overtime.date,
  });

  return { ok: true, message: approved ? "Lembur disetujui" : "Lembur ditolak" };
}

export async function approveLeaveViaTelegram(id: string, actor: Actor, approved: boolean) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { nik: true, name: true, supervisorId: true } } },
  });
  if (!leave) return { ok: false, error: "Pengajuan tidak ditemukan" };
  if (leave.approvalStatus === "APPROVED" || leave.approvalStatus === "REJECTED") {
    return { ok: false, error: "Pengajuan sudah final" };
  }

  if (!approved) {
    const canReject =
      (leave.approvalStatus === "PENDING" &&
        (await canApproveAsAtasan(actor.id, actor.role, leave.userId))) ||
      (leave.approvalStatus === "ATASAN_APPROVED" && canApproveAsHrd(actor.role)) ||
      (leave.approvalStatus === "PENDING" &&
        !(await requiresAtasanApproval(leave.leaveType)) &&
        canApproveAsHrd(actor.role));

    if (!canReject) return { ok: false, error: "Forbidden" };

    await prisma.leaveRequest.update({
      where: { id },
      data: { approvalStatus: "REJECTED" },
    });
    await writeAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      action: "REJECT",
      entity: "LeaveRequest",
      entityId: id,
      details: leave.leaveType,
    });
    void notifyLeaveDecided({ userId: leave.userId, leaveType: leave.leaveType, approved: false });
    return { ok: true, message: "Cuti ditolak" };
  }

  const needsAtasan = await requiresAtasanApproval(leave.leaveType);

  if (needsAtasan && leave.approvalStatus === "PENDING") {
    if (!(await canApproveAsAtasan(actor.id, actor.role, leave.userId))) {
      return { ok: false, error: "Hanya atasan yang dapat menyetujui tahap ini" };
    }
    await prisma.leaveRequest.update({
      where: { id },
      data: {
        approvalStatus: "ATASAN_APPROVED",
        atasanApprovedBy: actor.id,
        atasanApprovedAt: new Date(),
      },
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
      atasanName: actor.name,
    });
    return { ok: true, message: "Disetujui atasan — diteruskan ke HRD (thread)" };
  }

  const readyForHrd =
    (needsAtasan && leave.approvalStatus === "ATASAN_APPROVED") ||
    (!needsAtasan && leave.approvalStatus === "PENDING");

  if (!readyForHrd || !canApproveAsHrd(actor.role)) {
    return { ok: false, error: "Hanya HRD yang dapat menyetujui tahap final" };
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      approvalStatus: "APPROVED",
      hrdApprovedBy: actor.id,
      hrdApprovedAt: new Date(),
      approvedBy: actor.id,
      approvedAt: new Date(),
    },
  });
  await syncApprovedLeaveToAttendance(id);
  await writeAuditLog({
    actorId: actor.id,
    actorName: actor.name,
    action: "APPROVE",
    entity: "LeaveRequest",
    entityId: id,
    details: leave.leaveType,
  });
  void notifyLeaveDecided({ userId: leave.userId, leaveType: leave.leaveType, approved: true });
  return { ok: true, message: "Cuti disetujui" };
}

export async function approveFundViaTelegram(id: string, actor: Actor, approved: boolean) {
  if (!hasPermission(actor.role, "finance:approve")) {
    return { ok: false, error: "Anda tidak punya akses approve keuangan" };
  }

  const fund = await prisma.fundRequest.findUnique({ where: { id } });
  if (!fund) return { ok: false, error: "Pengajuan tidak ditemukan" };
  if (fund.status !== "PENDING") return { ok: false, error: "Pengajuan sudah diproses" };

  await prisma.fundRequest.update({
    where: { id },
    data: approved
      ? { status: "APPROVED", approvedBy: actor.nik, approvedAt: new Date() }
      : { status: "REJECTED" },
  });

  void notifyFundDecided({
    submittedBy: fund.submittedBy,
    title: fund.title,
    approved,
  });

  return { ok: true, message: approved ? "Pengajuan disetujui" : "Pengajuan ditolak" };
}
