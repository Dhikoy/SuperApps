import { prisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/roles";
import { getJakartaTodayStart } from "@/lib/timezone";
import { resolveAttendanceStatus } from "@/lib/attendance-time";
import { resolvePresensiForUser, standardClockInFromConfig } from "@/lib/resolve-presensi";
import { DEFAULT_CLOCK_IN, DEFAULT_CLOCK_OUT } from "@/lib/attendance-time";
import { approveKeyboard, appBaseUrl, sendTelegramMessage } from "@/lib/telegram/client";
import { clearBotSession, getBotSession, patchBotSession, setBotSession } from "@/lib/telegram/bot-session";
import { findUsersByPermission, notifyLeaveSubmitted } from "@/lib/telegram/notify";
import { calcItemSubtotal, calcTotalAmount } from "@/lib/finance-workflow";
import { saveSelfieImage } from "@/lib/selfie-storage";
import { downloadTelegramFileAsDataUrl } from "@/lib/telegram/client";
import { dateKeyJakarta } from "@/lib/telegram/reminders-shared";

export type UserRef = { nik: string; id: string; name: string; role: Role; company: string | null };

function isHrOrSuper(role: Role) {
  return role === "SUPER_ADMIN" || hasPermission(role, "hr:manage");
}

function parseDateInput(text: string): Date | null {
  const t = text.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+07:00`);
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00+07:00`);
  }
  return null;
}

function weekRangeJakarta(base = new Date()) {
  const today = getJakartaTodayStart(base);
  const day = today.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** 1. Koreksi absensi */
export async function startCorrectionFlow(chatId: string, user: UserRef) {
  if (!hasPermission(user.role, "attendance:clock")) {
    await sendTelegramMessage(chatId, "Tidak punya akses.");
    return;
  }
  const today = getJakartaTodayStart();
  const att = await prisma.attendance.findFirst({ where: { userId: user.id, date: today } });
  await setBotSession(chatId, "correction", "clockin", {
    attendanceId: att?.id ?? null,
    currentIn: att?.clockInTime ?? null,
    currentOut: att?.clockOutTime ?? null,
  });
  await sendTelegramMessage(
    chatId,
    `Koreksi absensi hari ini\nMasuk sekarang: ${att?.clockInTime ?? "—"}\nPulang sekarang: ${att?.clockOutTime ?? "—"}\n\nKirim jam masuk yang benar (HH:MM) atau - jika tidak diubah.`
  );
}

export async function handleCorrectionText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "correction") return false;

  if (session.step === "clockin") {
    const v = text.trim() === "-" ? null : text.trim();
    if (v && !/^\d{1,2}:\d{2}$/.test(v)) {
      await sendTelegramMessage(chatId, "Format jam HH:MM, contoh 09:15");
      return true;
    }
    await patchBotSession(chatId, "clockout", { requestedClockIn: v });
    await sendTelegramMessage(chatId, "Kirim jam pulang yang benar (HH:MM) atau -");
    return true;
  }
  if (session.step === "clockout") {
    const v = text.trim() === "-" ? null : text.trim();
    if (v && !/^\d{1,2}:\d{2}$/.test(v)) {
      await sendTelegramMessage(chatId, "Format jam HH:MM");
      return true;
    }
    await patchBotSession(chatId, "reason", { requestedClockOut: v });
    await sendTelegramMessage(chatId, "Alasan koreksi?");
    return true;
  }
  if (session.step === "reason") {
    const reason = text.trim();
    if (reason.length < 3) {
      await sendTelegramMessage(chatId, "Alasan terlalu pendek.");
      return true;
    }
    const today = getJakartaTodayStart();
    const corr = await prisma.attendanceCorrection.create({
      data: {
        userId: user.id,
        attendanceId: (session.data.attendanceId as string) || null,
        date: today,
        requestedClockIn: (session.data.requestedClockIn as string) || null,
        requestedClockOut: (session.data.requestedClockOut as string) || null,
        reason,
      },
    });
    const hrs = await findUsersByPermission("hr:manage");
    const body =
      `✏️ Koreksi absensi\n${user.name}\n` +
      `Masuk → ${corr.requestedClockIn ?? "(tetap)"}\n` +
      `Pulang → ${corr.requestedClockOut ?? "(tetap)"}\n` +
      `Alasan: ${reason}`;
    for (const h of hrs) {
      await sendTelegramMessage(h.telegramChatId!, body, {
        reply_markup: approveKeyboard("ac", corr.id),
      });
    }
    await clearBotSession(chatId);
    await sendTelegramMessage(chatId, "Pengajuan koreksi dikirim ke HRD ✅");
    return true;
  }
  return false;
}

export async function approveCorrectionViaTelegram(
  id: string,
  actor: { nik: string; role: Role; name: string },
  approved: boolean
) {
  const { reviewAttendanceCorrection } = await import("@/lib/attendance-correction");
  return reviewAttendanceCorrection(id, actor, approved);
}

/** 2. Izin terlambat cepat */
export async function startLatePermit(chatId: string, user: UserRef) {
  if (!hasPermission(user.role, "leave:submit")) {
    await sendTelegramMessage(chatId, "Tidak punya akses.");
    return;
  }
  await setBotSession(chatId, "latepermit", "reason", {});
  await sendTelegramMessage(chatId, "Izin terlambat hari ini.\nKetik alasan singkat:");
}

export async function handleLatePermitText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "latepermit") return false;
  if (session.step !== "reason") return false;
  const reason = text.trim();
  if (reason.length < 3) {
    await sendTelegramMessage(chatId, "Alasan terlalu pendek.");
    return true;
  }
  const today = getJakartaTodayStart();
  const leave = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      leaveType: "Izin Terlambat",
      startDate: today,
      endDate: today,
      remarks: reason,
    },
  });
  void notifyLeaveSubmitted({
    id: leave.id,
    leaveType: "Izin Terlambat",
    startDate: today,
    endDate: today,
    userId: user.id,
    needsAtasan: false,
  });
  await clearBotSession(chatId);
  await sendTelegramMessage(chatId, "Izin terlambat dikirim ke HRD ✅");
  return true;
}

/** 3. Laporan mingguan HR / Super Admin */
export async function sendWeeklyHrReport(chatId: string, user: UserRef) {
  if (!isHrOrSuper(user.role)) {
    await sendTelegramMessage(chatId, "Khusus HRD / Super Admin / Admin.");
    return;
  }
  const { start, end } = weekRangeJakarta();
  const whereCompany = user.role === "SUPER_ADMIN" || user.role === "ADMIN" ? {} : user.company ? { company: user.company } : {};

  const late = await prisma.attendance.findMany({
    where: {
      date: { gte: start, lte: end },
      status: "TERLAMBAT",
      user: whereCompany,
    },
    include: { user: { select: { name: true, company: true } } },
  });
  const noOut = await prisma.attendance.findMany({
    where: {
      date: { gte: start, lte: end },
      clockInTime: { not: null },
      clockOutTime: null,
      user: whereCompany,
    },
    include: { user: { select: { name: true, company: true } } },
  });

  const lateMap = new Map<string, number>();
  for (const a of late) {
    lateMap.set(a.user.name, (lateMap.get(a.user.name) ?? 0) + 1);
  }
  const noOutMap = new Map<string, number>();
  for (const a of noOut) {
    noOutMap.set(a.user.name, (noOutMap.get(a.user.name) ?? 0) + 1);
  }

  const lateLines = [...lateMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([n, c]) => `• ${n}: ${c}x`);
  const outLines = [...noOutMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([n, c]) => `• ${n}: ${c}x`);

  await sendTelegramMessage(
    chatId,
    `📊 Laporan mingguan (${start.toLocaleDateString("id-ID")}–${end.toLocaleDateString("id-ID")})\n\n` +
      `Terlambat (${late.length} kejadian):\n${lateLines.length ? lateLines.join("\n") : "— tidak ada"}\n\n` +
      `Belum clock-out (${noOut.length} kejadian):\n${outLines.length ? outLines.join("\n") : "— tidak ada"}\n\n` +
      `Detail: ${appBaseUrl()}/dashboard/presensi/laporan`
  );
}

/** 8. Jadwal minggu ini */
export async function sendWeekSchedule(chatId: string, user: UserRef) {
  const full = await prisma.user.findUnique({
    where: { nik: user.nik },
    include: { officeLocation: true, workSchedule: true },
  });
  if (!full) {
    await sendTelegramMessage(chatId, "User tidak ditemukan.");
    return;
  }
  const presensi = await resolvePresensiForUser(full);
  const cin = standardClockInFromConfig(presensi.schedule) || DEFAULT_CLOCK_IN;
  const cout = presensi.schedule?.standardClockOut || DEFAULT_CLOCK_OUT;
  const shift = presensi.schedule?.shiftName ?? "Default";
  const { start, end } = weekRangeJakarta();
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const lines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    lines.push(
      `${days[i]} ${d.toLocaleDateString("id-ID")} — ${isWeekend ? "Libur (cek jadwal PT)" : `${shift} ${cin}–${cout}`}`
    );
  }
  await sendTelegramMessage(
    chatId,
    `📅 Jadwal minggu ini\nKantor: ${presensi.office?.name ?? user.company ?? "—"}\n\n${lines.join("\n")}`
  );
}

/** 9. Ajukan perjalanan dinas (self) */
export async function startTripFlow(chatId: string, user: UserRef) {
  await setBotSession(chatId, "trip", "dest", {});
  await sendTelegramMessage(chatId, "Ajukan perjalanan dinas\nTujuan kota/lokasi?");
}

export async function handleTripText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "trip") return false;
  if (session.step === "dest") {
    await patchBotSession(chatId, "start", { destination: text.trim() });
    await sendTelegramMessage(chatId, "Tanggal mulai? (DD/MM/YYYY)");
    return true;
  }
  if (session.step === "start") {
    const d = parseDateInput(text);
    if (!d) {
      await sendTelegramMessage(chatId, "Format tanggal salah.");
      return true;
    }
    await patchBotSession(chatId, "end", { startDate: d.toISOString() });
    await sendTelegramMessage(chatId, "Tanggal selesai?");
    return true;
  }
  if (session.step === "end") {
    const d = parseDateInput(text);
    if (!d) {
      await sendTelegramMessage(chatId, "Format tanggal salah.");
      return true;
    }
    await patchBotSession(chatId, "purpose", { endDate: d.toISOString() });
    await sendTelegramMessage(chatId, "Keperluan? (atau -)");
    return true;
  }
  if (session.step === "purpose") {
    const purpose = text.trim() === "-" ? null : text.trim();
    const destination = String(session.data.destination);
    const startDate = new Date(String(session.data.startDate));
    const endDate = new Date(String(session.data.endDate));
    const trip = await prisma.businessTrip.create({
      data: {
        userId: user.id,
        destination,
        startDate,
        endDate,
        purpose,
      },
    });
    const { notifyBusinessTripSubmitted } = await import("@/lib/telegram/extras");
    void notifyBusinessTripSubmitted({
      id: trip.id,
      destination,
      startDate,
      endDate,
      userName: user.name,
    });
    await clearBotSession(chatId);
    await sendTelegramMessage(chatId, "Perjalanan dinas diajukan ✅ Menunggu HRD.");
    return true;
  }
  return false;
}

/** 10. Update progress task */
export async function startTaskProgressFlow(chatId: string, user: UserRef) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.nik, status: { not: "DONE" } },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });
  if (!tasks.length) {
    await sendTelegramMessage(chatId, "Tidak ada task aktif.");
    return;
  }
  await setBotSession(chatId, "taskprog", "pick", {});
  await sendTelegramMessage(chatId, "Pilih task untuk update progress:", {
    reply_markup: {
      inline_keyboard: tasks.map((t) => [
        { text: t.title.slice(0, 40), callback_data: `tpick:${t.id}` },
      ]),
    },
  });
}

export async function handleTaskPick(chatId: string, taskId: string) {
  await setBotSession(chatId, "taskprog", "note", { taskId });
  await sendTelegramMessage(chatId, "Tulis catatan progress:");
}

export async function handleTaskProgressText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "taskprog" || session.step !== "note") return false;
  const taskId = String(session.data.taskId);
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || (task.assigneeId !== user.nik && !hasPermission(user.role, "tasks:manage"))) {
    await clearBotSession(chatId);
    await sendTelegramMessage(chatId, "Task tidak valid.");
    return true;
  }
  await prisma.taskProgress.create({
    data: { taskId, note: text.trim(), authorId: user.nik },
  });
  await clearBotSession(chatId);
  await sendTelegramMessage(chatId, `Progress tersimpan ✅\nTask: ${task.title}`);
  return true;
}

/** 12. Ajukan dana sederhana */
export async function startSimpleFund(chatId: string, user: UserRef) {
  if (!hasPermission(user.role, "finance:submit")) {
    await sendTelegramMessage(chatId, "Tidak punya akses pengajuan dana.");
    return;
  }
  if (!user.company) {
    await sendTelegramMessage(chatId, "PT belum di-set.");
    return;
  }
  await setBotSession(chatId, "fund", "title", {});
  await sendTelegramMessage(chatId, "Ajukan dana\nJudul pengajuan?");
}

export async function handleFundText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "fund") return false;
  if (session.step === "title") {
    await patchBotSession(chatId, "amount", { title: text.trim() });
    await sendTelegramMessage(chatId, "Nominal (angka saja, contoh 150000)?");
    return true;
  }
  if (session.step === "amount") {
    const amount = Number(text.replace(/[^\d.]/g, ""));
    if (!amount || amount <= 0) {
      await sendTelegramMessage(chatId, "Nominal tidak valid.");
      return true;
    }
    await patchBotSession(chatId, "desc", { amount });
    await sendTelegramMessage(chatId, "Keterangan? (atau -)");
    return true;
  }
  if (session.step === "desc") {
    const description = text.trim() === "-" ? null : text.trim();
    const title = String(session.data.title);
    const amount = Number(session.data.amount);
    const items = [
      {
        itemName: title,
        quantity: 1,
        unit: "paket",
        unitPrice: amount,
        subtotal: calcItemSubtotal(1, amount),
      },
    ];
    const fund = await prisma.fundRequest.create({
      data: {
        title,
        company: user.company!.toUpperCase(),
        description,
        totalAmount: calcTotalAmount(items),
        submittedBy: user.id,
        items: { create: items },
      },
      include: { submitter: { select: { name: true } } },
    });
    const { notifyFundSubmitted } = await import("@/lib/telegram/notify");
    void notifyFundSubmitted({
      id: fund.id,
      title: fund.title,
      company: fund.company,
      totalAmount: fund.totalAmount,
      submitterName: fund.submitter.name,
    });
    await clearBotSession(chatId);
    await sendTelegramMessage(chatId, `Pengajuan dana dikirim ✅\n${title}\nRp ${amount.toLocaleString("id-ID")}`);
    return true;
  }
  return false;
}

/** 13. Bayar dana + bukti foto (Keuangan) */
export async function startPayFundFlow(chatId: string, user: UserRef) {
  if (!hasPermission(user.role, "finance:pay")) {
    await sendTelegramMessage(chatId, "Tidak punya akses pembayaran.");
    return;
  }
  const list = await prisma.fundRequest.findMany({
    where: { status: "APPROVED" },
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { submitter: { select: { name: true } } },
  });
  if (!list.length) {
    await sendTelegramMessage(chatId, "Tidak ada pengajuan APPROVED yang menunggu bayar.");
    return;
  }
  await setBotSession(chatId, "payfund", "pick", {});
  await sendTelegramMessage(chatId, "Pilih pengajuan untuk dibayar:", {
    reply_markup: {
      inline_keyboard: list.map((f) => [
        {
          text: `${f.title.slice(0, 28)} (${f.submitter.name})`.slice(0, 60),
          callback_data: `paypick:${f.id}`,
        },
      ]),
    },
  });
}

export async function handlePayPick(chatId: string, fundId: string) {
  await setBotSession(chatId, "payfund", "ref", { fundId });
  await sendTelegramMessage(chatId, "No. referensi transfer / ketik - jika tidak ada:");
}

export async function handlePayFundText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "payfund") return false;
  if (session.step === "ref") {
    await patchBotSession(chatId, "proof", {
      paymentRef: text.trim() === "-" ? null : text.trim(),
    });
    await sendTelegramMessage(chatId, "Kirim foto bukti transfer (atau ketik lewati).");
    return true;
  }
  if (session.step === "proof" && text.trim().toLowerCase() === "lewati") {
    await finalizePay(chatId, user, null);
    return true;
  }
  return false;
}

export async function handlePayFundPhoto(chatId: string, user: UserRef, fileId: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "payfund" || session.step !== "proof") return false;
  const dataUrl = await downloadTelegramFileAsDataUrl(fileId);
  if (!dataUrl) {
    await sendTelegramMessage(chatId, "Gagal unduh foto. Ketik lewati atau kirim ulang.");
    return true;
  }
  const stored = await saveSelfieImage(dataUrl, {
    userNik: user.nik,
    kind: "in",
    date: new Date(),
  });
  await finalizePay(chatId, user, stored);
  return true;
}

async function finalizePay(chatId: string, user: UserRef, proofPath: string | null) {
  const session = await getBotSession(chatId);
  if (!session) return;
  const fundId = String(session.data.fundId);
  const paymentRef = (session.data.paymentRef as string) || null;
  const fund = await prisma.fundRequest.findUnique({ where: { id: fundId } });
  if (!fund || fund.status !== "APPROVED") {
    await clearBotSession(chatId);
    await sendTelegramMessage(chatId, "Pengajuan tidak valid / sudah dibayar.");
    return;
  }
  const { syncFundRequestJournals } = await import("@/lib/accounting/journal");
  await prisma.$transaction(async (tx) => {
    await tx.fundRequest.update({
      where: { id: fundId },
      data: {
        status: "PAID",
        paidBy: user.nik,
        paidAt: new Date(),
        paymentRef,
        paymentProof: proofPath,
      },
    });
    await syncFundRequestJournals(tx, fundId);
  });
  const { notifyFundStage } = await import("@/lib/telegram/extras");
  void notifyFundStage({ submittedBy: fund.submittedBy, title: fund.title, stage: "PAID" });
  if (proofPath) {
    const submitter = await prisma.user.findUnique({
      where: { nik: fund.submittedBy },
      select: { telegramChatId: true },
    });
    if (submitter?.telegramChatId) {
      await sendTelegramMessage(
        submitter.telegramChatId,
        `Pembayaran "${fund.title}" dikonfirmasi.\nRef: ${paymentRef ?? "—"}\nBukti tersimpan di sistem.`
      );
    }
  }
  await clearBotSession(chatId);
  await sendTelegramMessage(chatId, `Pembayaran dicatat ✅\n${fund.title}`);
}

/** 11. Birthday + contract expiry (HR) */
export async function runHrLifeEventReminders() {
  const key = dateKeyJakarta();
  const now = new Date();
  const m = now.getMonth();
  const d = now.getDate();

  const users = await prisma.user.findMany({
    select: { nik: true, name: true, birthDate: true, company: true },
  });
  const birthdays = users.filter((u) => {
    if (!u.birthDate) return false;
    return u.birthDate.getMonth() === m && u.birthDate.getDate() === d;
  });

  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const contracts = await prisma.employmentContract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gte: now, lte: in30 },
    },
    include: { user: { select: { name: true, company: true } } },
  });

  const hrs = await findUsersByPermission("hr:manage");
  let sent = 0;
  for (const h of hrs) {
    if (!h.telegramChatId) continue;
    const already = await prisma.telegramReminderLog.findUnique({
      where: { userId_dateKey_kind: { userId: h.nik, dateKey: key, kind: "hr_life" } },
    });
    if (already) continue;
    const parts: string[] = [];
    if (birthdays.length) {
      parts.push(
        `🎂 Ulang tahun hari ini:\n${birthdays.map((b) => `• ${b.name} (${b.company ?? "-"})`).join("\n")}`
      );
    }
    if (contracts.length) {
      parts.push(
        `📄 Kontrak habis ≤30 hari:\n${contracts
          .map(
            (c) =>
              `• ${c.user.name} — ${c.endDate!.toLocaleDateString("id-ID")} (${c.type})`
          )
          .join("\n")}`
      );
    }
    if (!parts.length) continue;
    await sendTelegramMessage(h.telegramChatId, `HR Reminder\n\n${parts.join("\n\n")}`);
    await prisma.telegramReminderLog
      .create({ data: { userId: h.nik, dateKey: key, kind: "hr_life" } })
      .catch(() => {});
    sent++;
  }
  return sent;
}

/** 14. Digital asset H-7 and H-1 (extend) */
export async function runDigitalAssetDueH7H1() {
  const assets = await prisma.digitalAsset.findMany();
  if (!assets.length) return 0;
  const now = new Date();
  const key = dateKeyJakarta();
  const { formatRupiah } = await import("@/lib/payroll-policy");

  function nextBillingDate(activeFrom: Date, cycle: "BULANAN" | "TAHUNAN", from: Date): Date {
    const d = new Date(activeFrom);
    if (cycle === "TAHUNAN") {
      while (d < from) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    while (d < from) d.setMonth(d.getMonth() + 1);
    return d;
  }

  const h7: string[] = [];
  const h1: string[] = [];
  for (const a of assets) {
    const next = nextBillingDate(a.activeFrom, a.billingCycle, now);
    const diff = Math.ceil((next.getTime() - now.getTime()) / (24 * 3600 * 1000));
    const line = `• ${a.serviceName} — ${next.toLocaleDateString("id-ID")} — ${formatRupiah(a.cost)}`;
    if (diff === 7) h7.push(line);
    if (diff === 1) h1.push(line);
  }
  if (!h7.length && !h1.length) return 0;

  const targets = await findUsersByPermission("digital_assets:manage");
  let sent = 0;
  for (const t of targets) {
    if (!t.telegramChatId) continue;
    for (const [kind, lines, title] of [
      ["asset_h7", h7, "H-7 tagihan aset digital"],
      ["asset_h1", h1, "H-1 tagihan aset digital"],
    ] as const) {
      if (!lines.length) continue;
      const already = await prisma.telegramReminderLog.findUnique({
        where: { userId_dateKey_kind: { userId: t.nik, dateKey: key, kind } },
      });
      if (already) continue;
      await sendTelegramMessage(t.telegramChatId, `💻 ${title}\n${lines.join("\n")}`);
      await prisma.telegramReminderLog
        .create({ data: { userId: t.nik, dateKey: key, kind } })
        .catch(() => {});
      sent++;
    }
  }
  return sent;
}
