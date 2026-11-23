import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { resolveAttendanceStatus, DEFAULT_CLOCK_IN } from "@/lib/attendance-time";
import { resolvePresensiForUser, standardClockInFromConfig } from "@/lib/resolve-presensi";
import { sendTelegramMessage } from "@/lib/telegram/client";

export function canReviewAttendanceCorrection(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "hr:manage");
}

const VALID_STATUS = new Set(["PENDING", "APPROVED", "REJECTED"]);

export async function listAttendanceCorrections(status?: string) {
  const statusFilter =
    status && VALID_STATUS.has(status)
      ? (status as "PENDING" | "APPROVED" | "REJECTED")
      : undefined;

  return prisma.attendanceCorrection.findMany({
    where: statusFilter ? { approvalStatus: statusFilter } : undefined,
    include: {
      user: { select: { nik: true, name: true, company: true, userId: true } },
      attendance: {
        select: { clockInTime: true, clockOutTime: true, status: true },
      },
    },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function reviewAttendanceCorrection(
  id: string,
  actor: { nik: string; role: Role; name: string },
  approved: boolean
) {
  if (!canReviewAttendanceCorrection(actor.role)) {
    return { ok: false as const, error: "Hanya HRD / Admin / Super Admin" };
  }

  const corr = await prisma.attendanceCorrection.findUnique({ where: { id } });
  if (!corr) return { ok: false as const, error: "Pengajuan tidak ditemukan" };
  if (corr.approvalStatus !== "PENDING") {
    return { ok: false as const, error: "Pengajuan sudah diproses" };
  }

  if (!approved) {
    await prisma.attendanceCorrection.update({
      where: { id },
      data: { approvalStatus: "REJECTED", reviewedBy: actor.nik, reviewedAt: new Date() },
    });
    const u = await prisma.user.findUnique({
      where: { nik: corr.userId },
      select: { telegramChatId: true },
    });
    if (u?.telegramChatId) {
      await sendTelegramMessage(u.telegramChatId, "Koreksi absensi ditolak ❌");
    }
    return { ok: true as const, message: "Koreksi ditolak" };
  }

  let att = corr.attendanceId
    ? await prisma.attendance.findUnique({ where: { id: corr.attendanceId } })
    : await prisma.attendance.findFirst({ where: { userId: corr.userId, date: corr.date } });

  const user = await prisma.user.findUnique({
    where: { nik: corr.userId },
    include: { officeLocation: true, workSchedule: true },
  });
  const presensi = user ? await resolvePresensiForUser(user) : null;
  const standardIn = standardClockInFromConfig(presensi?.schedule) || DEFAULT_CLOCK_IN;
  const newIn = corr.requestedClockIn ?? att?.clockInTime ?? null;
  const newOut = corr.requestedClockOut ?? att?.clockOutTime ?? null;
  const status = newIn ? resolveAttendanceStatus(newIn, standardIn) : att?.status ?? "HADIR";

  if (att) {
    att = await prisma.attendance.update({
      where: { id: att.id },
      data: { clockInTime: newIn, clockOutTime: newOut, status },
    });
  } else if (newIn) {
    att = await prisma.attendance.create({
      data: {
        userId: corr.userId,
        date: corr.date,
        clockInTime: newIn,
        clockOutTime: newOut,
        status,
      },
    });
  }

  await prisma.attendanceCorrection.update({
    where: { id },
    data: {
      approvalStatus: "APPROVED",
      reviewedBy: actor.nik,
      reviewedAt: new Date(),
      attendanceId: att?.id,
    },
  });

  const u = await prisma.user.findUnique({
    where: { nik: corr.userId },
    select: { telegramChatId: true },
  });
  if (u?.telegramChatId) {
    await sendTelegramMessage(
      u.telegramChatId,
      `Koreksi absensi disetujui ✅\nMasuk: ${newIn ?? "—"}\nPulang: ${newOut ?? "—"}`
    );
  }

  return { ok: true as const, message: "Koreksi disetujui" };
}
