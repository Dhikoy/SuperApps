import { prisma } from "@/lib/prisma";
import {
  CUTI_WITH_ATASAN,
  HRD_ONLY_LEAVE,
  getApprovalFlowLabel,
  getNextApprovalStageSync,
  requiresAtasanApprovalSync,
} from "@/lib/leave-shared";

export {
  CUTI_WITH_ATASAN,
  HRD_ONLY_LEAVE,
  getApprovalFlowLabel,
  getNextApprovalStageSync,
  requiresAtasanApprovalSync,
};

export async function requiresAtasanApproval(leaveType: string): Promise<boolean> {
  try {
    const row = await prisma.leaveType.findUnique({ where: { name: leaveType } });
    if (row) return row.requiresAtasan;
  } catch {
    /* fallback */
  }
  return requiresAtasanApprovalSync(leaveType);
}

export async function getNextApprovalStage(
  leaveType: string,
  currentStatus: string
): Promise<"atasan" | "hrd" | "done" | "rejected"> {
  const needsAtasan = await requiresAtasanApproval(leaveType);
  return getNextApprovalStageSync(leaveType, currentStatus, needsAtasan);
}
