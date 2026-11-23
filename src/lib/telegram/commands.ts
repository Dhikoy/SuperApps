import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { formatPeriodLabel, getPeriodForDate } from "@/lib/period";
import { loadUserPayrollItem } from "@/lib/payroll-data";
import { notifyPayrollSlip } from "@/lib/telegram/notify";
import { appBaseUrl, sendTelegramMessage } from "@/lib/telegram/client";

async function loadSlip(userNik: string, year: number, month: number) {
  return (await loadUserPayrollItem(userNik, year, month))?.item ?? null;
}

export async function sendSlipCommand(userNik: string, chatId: string) {
  const period = getPeriodForDate();
  const item = await loadSlip(userNik, period.year, period.month);
  if (!item) {
    await sendTelegramMessage(chatId, "Akun tidak ditemukan.");
    return;
  }
  await sendTelegramMessage(
    chatId,
    `🧾 Slip ${formatPeriodLabel(period.year, period.month)}\n` +
      `Gaji pokok: Rp ${Math.round(item.gajiPokok).toLocaleString("id-ID")}\n` +
      `Lembur: Rp ${Math.round(item.overtime.tunjanganLembur).toLocaleString("id-ID")}\n` +
      (item.adjustment.allowance + item.adjustment.mealAllowance
        ? `Tunjangan & uang makan: Rp ${Math.round(item.adjustment.allowance + item.adjustment.mealAllowance).toLocaleString("id-ID")}\n`
        : "") +
      (item.penalty.amount + item.adjustment.deduction
        ? `Potongan: -Rp ${Math.round(item.penalty.amount + item.adjustment.deduction).toLocaleString("id-ID")}\n`
        : "") +
      `Total: Rp ${Math.round(item.totalGaji).toLocaleString("id-ID")}\n\n` +
      `Cetak: ${appBaseUrl()}/dashboard/profil`
  );
}

export async function notifySlipsAfterPayrollPost(year: number, month: number, company: string) {
  const users = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      ...(company !== "ALL" ? { company } : {}),
    },
    select: { nik: true },
  });

  let sent = 0;
  for (const user of users) {
    const item = await loadSlip(user.nik, year, month);
    if (!item || item.gajiPokok <= 0) continue;
    await notifyPayrollSlip({
      userId: user.nik,
      periodLabel: formatPeriodLabel(year, month),
      gajiPokok: item.gajiPokok,
      lembur: item.overtime.tunjanganLembur,
      total: item.totalGaji,
    });
    sent++;
  }
  return sent;
}

export async function sendPendingList(chatId: string, role: Role) {
  const lines: string[] = [];

  if (hasPermission(role, "payroll:manage")) {
    const n = await prisma.overtime.count({ where: { approvalStatus: "PENDING" } });
    if (n) lines.push(`• Lembur pending: ${n}`);
  }
  if (hasPermission(role, "leave:approve_atasan") || hasPermission(role, "leave:approve_hrd")) {
    const n = await prisma.leaveRequest.count({
      where: { approvalStatus: { in: ["PENDING", "ATASAN_APPROVED"] } },
    });
    if (n) lines.push(`• Cuti pending: ${n}`);
  }
  if (hasPermission(role, "finance:approve")) {
    const n = await prisma.fundRequest.count({ where: { status: "PENDING" } });
    if (n) lines.push(`• Dana pending: ${n}`);
  }

  if (!lines.length) {
    await sendTelegramMessage(chatId, "Tidak ada pending approval untuk role Anda.");
    return;
  }

  await sendTelegramMessage(
    chatId,
    `Pending approval\n${lines.join("\n")}\n\nDetail: ${appBaseUrl()}/dashboard\nAtau tunggu notifikasi tombol Setujui/Tolak.`
  );
}
