import { TASK_STATUS_LABELS } from "@/lib/tasks-shared";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { getJakartaTodayStart } from "@/lib/timezone";
import { resolvePresensiForUser, standardClockInFromConfig } from "@/lib/resolve-presensi";
import { DEFAULT_CLOCK_IN, DEFAULT_CLOCK_OUT } from "@/lib/attendance-time";
import { appBaseUrl, sendTelegramMessage } from "@/lib/telegram/client";
import { dateKeyJakarta } from "@/lib/telegram/reminders-shared";

type UserRef = { nik: string; id: string; name: string; role: Role; company: string | null };

export async function getAnnualLeaveRemaining(nik: string) {
  const year = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(new Date())
  );
  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: nik, approvalStatus: "APPROVED", leaveType: { in: ["Cuti Tahunan", "cuti tahunan"] } },
    select: { startDate: true, endDate: true },
  });
  let used = 0;
  for (const leave of leaves) {
    const cur = new Date(leave.startDate);
    const end = leave.endDate;
    while (cur <= end) {
      const y = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(cur)
      );
      if (y === year) used += 1;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return { year, quota: 12, used, remaining: Math.max(0, 12 - used) };
}

export async function sendCutiBalance(chatId: string, nik: string) {
  const b = await getAnnualLeaveRemaining(nik);
  await sendTelegramMessage(
    chatId,
    `🌴 Cuti Tahunan ${b.year}\nKuota: ${b.quota} hari\nTerpakai: ${b.used}\nSisa: ${b.remaining} hari`
  );
}

export async function sendHariIni(chatId: string, user: UserRef) {
  const today = getJakartaTodayStart();
  const full = await prisma.user.findUnique({
    where: { nik: user.nik },
    include: { officeLocation: true, workSchedule: true },
  });
  let shiftLine = "Shift: —";
  if (full) {
    const p = await resolvePresensiForUser(full);
    const cin = standardClockInFromConfig(p.schedule) || DEFAULT_CLOCK_IN;
    const cout = p.schedule?.standardClockOut || DEFAULT_CLOCK_OUT;
    shiftLine = `Shift: ${p.schedule?.shiftName ?? "Default"} (${cin}–${cout})`;
  }
  const att = await prisma.attendance.findFirst({ where: { userId: user.id, date: today } });
  const leaveBal = await getAnnualLeaveRemaining(user.nik);
  const myTasks = await prisma.task.count({
    where: { assigneeId: user.nik, status: { not: "DONE" } },
  });
  const pendingLeave = await prisma.leaveRequest.count({
    where: { userId: user.nik, approvalStatus: { in: ["PENDING", "ATASAN_APPROVED"] } },
  });

  let approvalBlock = "";
  if (
    hasPermission(user.role, "payroll:manage") ||
    hasPermission(user.role, "leave:approve_hrd") ||
    hasPermission(user.role, "leave:approve_atasan") ||
    hasPermission(user.role, "finance:approve")
  ) {
    const ot = hasPermission(user.role, "payroll:manage")
      ? await prisma.overtime.count({ where: { approvalStatus: "PENDING" } })
      : 0;
    const lv =
      hasPermission(user.role, "leave:approve_hrd") || hasPermission(user.role, "leave:approve_atasan")
        ? await prisma.leaveRequest.count({
            where: { approvalStatus: { in: ["PENDING", "ATASAN_APPROVED"] } },
          })
        : 0;
    const fn = hasPermission(user.role, "finance:approve")
      ? await prisma.fundRequest.count({ where: { status: "PENDING" } })
      : 0;
    approvalBlock = `\nPending approval → OT ${ot} · Cuti ${lv} · Dana ${fn}`;
  }

  await sendTelegramMessage(
    chatId,
    `📋 Ringkasan hari ini — ${user.name}\n` +
      `${shiftLine}\n` +
      `Absensi: ${att ? `Masuk ${att.clockInTime ?? "—"} · Pulang ${att.clockOutTime ?? "belum"} · ${att.status}` : "Belum clock in"}\n` +
      `Cuti tahunan sisa: ${leaveBal.remaining} hari\n` +
      `Cuti menunggu: ${pendingLeave}\n` +
      `Task aktif: ${myTasks}` +
      approvalBlock +
      `\n\nMenu: /menu · Web: ${appBaseUrl()}/dashboard`
  );
}

export async function sendMyTasks(chatId: string, nik: string) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: nik, status: { not: "DONE" } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  if (!tasks.length) {
    await sendTelegramMessage(chatId, "Tidak ada task aktif.");
    return;
  }
  const lines = tasks.map((t, i) => `${i + 1}. [${TASK_STATUS_LABELS[t.status]}] ${t.title} (${t.company})`);
  await sendTelegramMessage(chatId, `📌 Task aktif\n${lines.join("\n")}\n\nDetail: ${appBaseUrl()}/dashboard/task`);
}

export async function sendOnboarding(chatId: string, nik: string) {
  const items = await prisma.onboardingTask.findMany({
    where: { userId: nik },
    orderBy: { createdAt: "asc" },
  });
  if (!items.length) {
    await sendTelegramMessage(chatId, "Belum ada checklist onboarding.");
    return;
  }
  const lines = items.map((i) => `${i.completed ? "✅" : "⬜"} ${i.title}`);
  const done = items.filter((i) => i.completed).length;
  await sendTelegramMessage(
    chatId,
    `Onboarding (${done}/${items.length})\n${lines.join("\n")}\n\nUpdate status lewat HRD di web.`
  );
}

export async function sendMorningDigests() {
  const key = dateKeyJakarta();
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { nik: true, name: true, role: true, company: true, telegramChatId: true },
  });
  let sent = 0;
  for (const u of users) {
    if (!u.telegramChatId) continue;
    const already = await prisma.telegramReminderLog.findUnique({
      where: { userId_dateKey_kind: { userId: u.nik, dateKey: key, kind: "morning_digest" } },
    });
    if (already) continue;
    await sendHariIni(u.telegramChatId, {
      nik: u.nik,
      id: u.nik,
      name: u.name,
      role: u.role as Role,
      company: u.company,
    });
    await prisma.telegramReminderLog.create({
      data: { userId: u.nik, dateKey: key, kind: "morning_digest" },
    }).catch(() => {});
    sent++;
  }
  return sent;
}
