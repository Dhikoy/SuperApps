import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { detectStockAlerts } from "@/lib/stock";
import { formatRupiah } from "@/lib/payroll-policy";
import { approveKeyboard, appBaseUrl, sendTelegramMessage } from "@/lib/telegram/client";
import { findUsersByPermission } from "@/lib/telegram/notify";
import { dateKeyJakarta } from "@/lib/telegram/reminders-shared";

export async function notifyTaskAssigned(task: {
  id: string;
  title: string;
  company: string;
  assigneeId: string | null;
}) {
  if (!task.assigneeId) return;
  const user = await prisma.user.findUnique({
    where: { nik: task.assigneeId },
    select: { telegramChatId: true, name: true },
  });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(
    user.telegramChatId,
    `📌 Task baru untuk Anda\n[${task.company}] ${task.title}\n\nBuka: ${appBaseUrl()}/dashboard/task`
  );
}

export async function notifyBusinessTripSubmitted(trip: {
  id: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  userName: string;
}) {
  const hrs = await findUsersByPermission("hr:manage");
  const range = `${trip.startDate.toLocaleDateString("id-ID")} – ${trip.endDate.toLocaleDateString("id-ID")}`;
  const body = `✈️ Perjalanan Dinas\n${trip.userName}\n${trip.destination}\n${range}\n\nWeb: ${appBaseUrl()}/dashboard/hr/perjalanan`;
  for (const h of hrs) {
    await sendTelegramMessage(h.telegramChatId!, body, {
      reply_markup: approveKeyboard("bt", trip.id),
    });
  }
}

export async function notifyBusinessTripDecided(opts: {
  userId: string;
  destination: string;
  approved: boolean;
}) {
  const user = await prisma.user.findUnique({
    where: { nik: opts.userId },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(
    user.telegramChatId,
    `Perjalanan dinas ke ${opts.destination} ${opts.approved ? "disetujui ✅" : "ditolak ❌"}.`
  );
}

export async function notifyFundStage(opts: {
  submittedBy: string;
  title: string;
  stage: "PAID" | "REALIZED";
}) {
  const user = await prisma.user.findUnique({
    where: { nik: opts.submittedBy },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return;
  const label = opts.stage === "PAID" ? "sudah dibayar 💳" : "sudah direalisasi ✅";
  await sendTelegramMessage(user.telegramChatId, `Pengajuan dana "${opts.title}" ${label}.`);
}

export async function runStockLowAlerts() {
  const items = await prisma.stockItem.findMany();
  const alerts = detectStockAlerts(items);
  if (!alerts.length) return 0;
  const key = dateKeyJakarta();
  const targets = await findUsersByPermission("stock:manage");
  const finance = await findUsersByPermission("finance:view");
  const chatIds = new Map<string, string>();
  for (const u of [...targets, ...finance]) {
    if (u.telegramChatId) chatIds.set(u.nik, u.telegramChatId);
  }
  let sent = 0;
  for (const [, chatId] of chatIds) {
    const logKey = `stock_alert`;
    // one broadcast per day per user
    const userNik = [...chatIds.entries()].find(([, c]) => c === chatId)?.[0];
    if (!userNik) continue;
    const already = await prisma.telegramReminderLog.findUnique({
      where: { userId_dateKey_kind: { userId: userNik, dateKey: key, kind: logKey } },
    });
    if (already) continue;
    const lines = alerts.slice(0, 15).map((a) => `• ${a.name} (${a.company}): ${a.currentQty}/${a.minQuantity}`);
    await sendTelegramMessage(
      chatId,
      `📦 Stok menipis (${alerts.length})\n${lines.join("\n")}\n\nWeb: ${appBaseUrl()}/dashboard/keuangan/stock`
    );
    await prisma.telegramReminderLog.create({
      data: { userId: userNik, dateKey: key, kind: logKey },
    }).catch(() => {});
    sent++;
  }
  return sent;
}

/** Digital asset billing due within next 3 days (anniversary of activeFrom) */
export async function runDigitalAssetDueReminders() {
  const assets = await prisma.digitalAsset.findMany();
  if (!assets.length) return 0;
  const now = new Date();
  const key = dateKeyJakarta();
  const dueSoon: { name: string; cycle: string; nextDue: string; cost: number }[] = [];

  for (const a of assets) {
    const next = nextBillingDate(a.activeFrom, a.billingCycle, now);
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (24 * 3600 * 1000));
    if (diffDays >= 0 && diffDays <= 3) {
      dueSoon.push({
        name: a.serviceName,
        cycle: a.billingCycle,
        nextDue: next.toLocaleDateString("id-ID"),
        cost: a.cost,
      });
    }
  }
  if (!dueSoon.length) return 0;

  const targets = await findUsersByPermission("digital_assets:manage");
  let sent = 0;
  for (const t of targets) {
    if (!t.telegramChatId) continue;
    const already = await prisma.telegramReminderLog.findUnique({
      where: { userId_dateKey_kind: { userId: t.nik, dateKey: key, kind: "asset_due" } },
    });
    if (already) continue;
    const lines = dueSoon.map(
      (d) => `• ${d.name} (${d.cycle}) jatuh ${d.nextDue} — ${formatRupiah(d.cost)}`
    );
    await sendTelegramMessage(
      t.telegramChatId,
      `💻 Aset digital jatuh tempo ≤3 hari\n${lines.join("\n")}\n\nWeb: ${appBaseUrl()}/dashboard/aset?tab=digital`
    );
    await prisma.telegramReminderLog.create({
      data: { userId: t.nik, dateKey: key, kind: "asset_due" },
    }).catch(() => {});
    sent++;
  }
  return sent;
}

function nextBillingDate(activeFrom: Date, cycle: "BULANAN" | "TAHUNAN", from: Date): Date {
  const d = new Date(activeFrom);
  if (cycle === "TAHUNAN") {
    while (d < from) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  while (d < from) d.setMonth(d.getMonth() + 1);
  return d;
}

export async function notifyOnboardingCreated(userId: string, title: string) {
  const user = await prisma.user.findUnique({
    where: { nik: userId },
    select: { telegramChatId: true, name: true },
  });
  if (!user?.telegramChatId) return;
  await sendTelegramMessage(
    user.telegramChatId,
    `✅ Checklist onboarding baru\n• ${title}\n\nLihat: /onboarding`
  );
}

export async function broadcastToLinkedUsers(message: string, actorNik: string) {
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { telegramChatId: true, nik: true },
  });
  let sent = 0;
  for (const u of users) {
    if (!u.telegramChatId) continue;
    await sendTelegramMessage(u.telegramChatId, `📢 Pengumuman HRD\n\n${message}`);
    sent++;
  }
  void actorNik;
  return sent;
}

export async function approveBusinessTripViaTelegram(
  id: string,
  actor: { nik: string; role: Role; name: string },
  approved: boolean
) {
  if (!hasPermission(actor.role, "hr:manage")) {
    return { ok: false, error: "Forbidden" };
  }
  const trip = await prisma.businessTrip.findUnique({ where: { id } });
  if (!trip) return { ok: false, error: "Tidak ditemukan" };
  if (trip.approvalStatus !== "PENDING") return { ok: false, error: "Sudah diproses" };

  await prisma.businessTrip.update({
    where: { id },
    data: approved
      ? { approvalStatus: "APPROVED", approvedBy: actor.nik, approvedAt: new Date() }
      : { approvalStatus: "REJECTED" },
  });
  void notifyBusinessTripDecided({
    userId: trip.userId,
    destination: trip.destination,
    approved,
  });
  return { ok: true, message: approved ? "Perjalanan disetujui" : "Perjalanan ditolak" };
}
