/** Pure leave helpers — safe for client components (no Prisma). */

export const CUTI_WITH_ATASAN = [
  "Cuti Tahunan",
  "Cuti Melahirkan",
  "Cuti Penting",
] as const;

export const HRD_ONLY_LEAVE = ["Sakit", "Izin Terlambat"] as const;

export function requiresAtasanApprovalSync(leaveType: string) {
  return CUTI_WITH_ATASAN.includes(leaveType as (typeof CUTI_WITH_ATASAN)[number]);
}

export function getApprovalFlowLabel(leaveType: string, requiresAtasan = requiresAtasanApprovalSync(leaveType)) {
  if (requiresAtasan) {
    return "Karyawan → Atasan → HRD";
  }
  return "Karyawan → HRD";
}

export function getNextApprovalStageSync(
  leaveType: string,
  currentStatus: string,
  needsAtasan = requiresAtasanApprovalSync(leaveType)
): "atasan" | "hrd" | "done" | "rejected" {
  if (currentStatus === "REJECTED" || currentStatus === "APPROVED") return "done";
  if (needsAtasan) {
    if (currentStatus === "PENDING") return "atasan";
    if (currentStatus === "ATASAN_APPROVED") return "hrd";
  } else if (currentStatus === "PENDING") {
    return "hrd";
  }
  return "done";
}
