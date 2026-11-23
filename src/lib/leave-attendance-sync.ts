import { prisma } from "@/lib/prisma";
import { iterateJakartaDates } from "@/lib/workdays";
import { getJakartaTodayStart } from "@/lib/timezone";

/** Set status IZIN di presensi untuk setiap hari cuti yang disetujui */
export async function syncApprovedLeaveToAttendance(leaveId: string) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
  if (!leave || leave.approvalStatus !== "APPROVED") return { synced: 0 };

  const days = iterateJakartaDates(leave.startDate, leave.endDate);
  let synced = 0;

  for (const day of days) {
    const normalizedDay = getJakartaTodayStart(day);
    const existing = await prisma.attendance.findFirst({
      where: { userId: leave.userId, date: normalizedDay },
    });

    if (existing) {
      if (existing.status === "ALPHA" || existing.status === "IZIN") {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: { status: "IZIN" },
        });
        synced++;
      }
      continue;
    }

    await prisma.attendance.create({
      data: {
        userId: leave.userId,
        date: normalizedDay,
        status: "IZIN",
      },
    });
    synced++;
  }

  return { synced };
}

/** Sync semua cuti APPROVED yang belum punya record IZIN */
export async function syncAllApprovedLeaves() {
  const leaves = await prisma.leaveRequest.findMany({
    where: { approvalStatus: "APPROVED" },
    select: { id: true },
  });

  let total = 0;
  for (const leave of leaves) {
    const result = await syncApprovedLeaveToAttendance(leave.id);
    total += result.synced;
  }
  return { leaves: leaves.length, synced: total };
}
