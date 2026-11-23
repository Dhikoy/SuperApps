import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { approveKeyboard, appBaseUrl, sendTelegramMessage } from "@/lib/telegram/client";
import { formatRupiah } from "@/lib/payroll-policy";

export async function findUsersByPermission(permission: Parameters<typeof hasPermission>[1]) {
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { nik: true, name: true, role: true, telegramChatId: true },
  });
  return users.filter((u) => u.telegramChatId && hasPermission(u.role as Role, permission));
}

export async function notifyTelegramChat(chatId: string | null | undefined, text: string, reply_markup?: object) {
  if (!chatId) return;
  await sendTelegramMessage(chatId, text, reply_markup ? { reply_markup } : undefined);
}

export async function notifyOvertimeSubmitted(overtime: {
  id: string;
  hours: number;
  type: string;
  date: Date;
  description?: string | null;
  user: { name: string; company?: string | null };
}) {
  const approvers = await findUsersByPermission("payroll:manage");
  const dateLabel = overtime.date.toLocaleDateString("id-ID");
  const text =
    `🕒 *Pengajuan Lembur*\n` +
    `${overtime.user.name}${overtime.user.company ? ` (${overtime.user.company})` : ""}\n` +
    `${dateLabel} · ${overtime.hours} jam · ${overtime.type}\n` +
    (overtime.description ? `${overtime.description}\n` : "") +
    `\nBuka web: ${appBaseUrl()}/dashboard/payroll/lembur`;

  for (const a of approvers) {
    await sendTelegramMessage(a.telegramChatId!, text.replace(/\*/g, ""), {
      reply_markup: approveKeyboard("ot", overtime.id),
    });
  }
}

export async function notifyOvertimeDecided(opts: {
  userId: string;
  approved: boolean;
  hours: number;
  date: Date;
}) {
  const user = await prisma.user.findUnique({
    where: { nik: opts.userId },
    select: { telegramChatId: true, name: true },
  });
  if (!user?.telegramChatId) return;
  const status = opts.approved ? "disetujui ✅" : "ditolak ❌";
  await sendTelegramMessage(
    user.telegramChatId,
    `Lembur Anda (${opts.hours} jam, ${opts.date.toLocaleDateString("id-ID")}) ${status}.`
  );
}

export async function notifyLeaveSubmitted(leave: {
  id: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  userId: string;
  needsAtasan: boolean;
}) {
  const requester = await prisma.user.findUnique({
    where: { nik: leave.userId },
    select: { name: true, supervisorId: true, company: true },
  });
  if (!requester) return;

  const range = `${leave.startDate.toLocaleDateString("id-ID")} – ${leave.endDate.toLocaleDateString("id-ID")}`;
  const body =
    `📋 Pengajuan Cuti\n` +
    `${requester.name}${requester.company ? ` (${requester.company})` : ""}\n` +
    `${leave.leaveType}\n${range}\n\n` +
    `Web: ${appBaseUrl()}/dashboard/persetujuan`;

  if (leave.needsAtasan && requester.supervisorId) {
    const supervisor = await prisma.user.findUnique({
      where: { nik: requester.supervisorId },
      select: { telegramChatId: true },
    });
    if (supervisor?.telegramChatId) {
      await sendTelegramMessage(supervisor.telegramChatId, body, {
        reply_markup: approveKeyboard("lv", leave.id),
      });
    }
  } else {
    const hrds = await findUsersByPermission("leave:approve_hrd");
    for (const h of hrds) {
      await sendTelegramMessage(h.telegramChatId!, body, {
        reply_markup: approveKeyboard("lv", leave.id),
      });
    }
  }
}

export async function notifyLeaveNeedsHrd(leave: {
  id: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  userName: string;
  atasanName?: string;
}) {
  const hrds = await findUsersByPermission("leave:approve_hrd");
  const range = `${leave.startDate.toLocaleDateString("id-ID")} – ${leave.endDate.toLocaleDateString("id-ID")}`;
  const body =
    `📋 Cuti — tahap HRD (lanjutan thread)\n` +
    `${leave.userName}\n${leave.leaveType}\n${range}\n` +
    (leave.atasanName ? `Sudah disetujui atasan: ${leave.atasanName}\n` : "") +
    `\nWeb: ${appBaseUrl()}/dashboard/persetujuan`;
  for (const h of hrds) {
    await sendTelegramMessage(h.telegramChatId!, body, {
      reply_markup: approveKeyboard("lv", leave.id),
    });
  }
}

export async function notifyLeaveDecided(opts: {
  userId: string;
  leaveType: string;
  approved: boolean;
  stage?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { nik: opts.userId },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return;
  const msg = opts.approved
    ? opts.stage === "atasan"
      ? `Cuti ${opts.leaveType} disetujui atasan — menunggu HRD.`
      : `Cuti ${opts.leaveType} Anda disetujui ✅`
    : `Cuti ${opts.leaveType} Anda ditolak ❌`;
  await sendTelegramMessage(user.telegramChatId, msg);
}

export async function notifyFundSubmitted(fund: {
  id: string;
  title: string;
  company: string;
  totalAmount: number;
  submitterName: string;
}) {
  const approvers = await findUsersByPermission("finance:approve");
  const body =
    `💰 Pengajuan Dana\n` +
    `${fund.submitterName}\n` +
    `${fund.title} (${fund.company})\n` +
    `${formatRupiah(fund.totalAmount)}\n\n` +
    `Web: ${appBaseUrl()}/dashboard/keuangan/persetujuan`;
  for (const a of approvers) {
    await sendTelegramMessage(a.telegramChatId!, body, {
      reply_markup: approveKeyboard("fn", fund.id),
    });
  }
}

export async function notifyFundDecided(opts: {
  submittedBy: string;
  title: string;
  approved: boolean;
}) {
  const user = await prisma.user.findUnique({
    where: { nik: opts.submittedBy },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(
    user.telegramChatId,
    `Pengajuan dana "${opts.title}" ${opts.approved ? "disetujui ✅" : "ditolak ❌"}.`
  );
}

export async function notifyPayrollSlip(opts: {
  userId: string;
  periodLabel: string;
  gajiPokok: number;
  lembur: number;
  total: number;
}) {
  const user = await prisma.user.findUnique({
    where: { nik: opts.userId },
    select: { telegramChatId: true, name: true },
  });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(
    user.telegramChatId,
    `🧾 Slip Gaji ${opts.periodLabel}\n` +
      `Halo ${user.name},\n` +
      `Gaji pokok: ${formatRupiah(opts.gajiPokok)}\n` +
      `Lembur: ${formatRupiah(opts.lembur)}\n` +
      `Total: ${formatRupiah(opts.total)}\n\n` +
      `Detail & cetak: ${appBaseUrl()}/dashboard/profil`
  );
}
