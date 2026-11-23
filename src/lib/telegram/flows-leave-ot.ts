import { loadPolicy } from "@/lib/payroll-data";
import { prisma } from "@/lib/prisma";
import { getActiveLeaveTypes } from "@/lib/leave-types";
import { requiresAtasanApproval } from "@/lib/leave";
import { hasPermission, type Role } from "@/lib/roles";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { clearBotSession, getBotSession, patchBotSession, setBotSession } from "@/lib/telegram/bot-session";
import { notifyLeaveSubmitted } from "@/lib/telegram/notify";
import { resolveOvertimeType } from "@/lib/payroll";
import { toDateKey } from "@/lib/holidays";
import { notifyOvertimeSubmitted } from "@/lib/telegram/notify";

type UserRef = { nik: string; id: string; name: string; role: Role; company: string | null };

function parseDateInput(text: string): Date | null {
  const t = text.trim();
  // YYYY-MM-DD or DD/MM/YYYY
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+07:00`);
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return new Date(`${m[3]}-${mo}-${d}T00:00:00+07:00`);
  }
  return null;
}

export async function startLeaveFlow(chatId: string, user: UserRef) {
  if (!hasPermission(user.role, "leave:submit")) {
    await sendTelegramMessage(chatId, "Anda tidak punya akses ajukan cuti.");
    return;
  }
  const types = await getActiveLeaveTypes();
  if (!types.length) {
    await sendTelegramMessage(chatId, "Jenis cuti belum dikonfigurasi. Hubungi HRD.");
    return;
  }
  await setBotSession(chatId, "leave", "type", {});
  await sendTelegramMessage(chatId, "Pilih jenis cuti:", {
    reply_markup: {
      inline_keyboard: types.map((t) => [{ text: t.name, callback_data: `lvflow:type:${t.name}` }]),
    },
  });
}

export async function handleLeaveFlowCallback(chatId: string, user: UserRef, data: string) {
  if (data.startsWith("lvflow:type:")) {
    const leaveType = data.slice("lvflow:type:".length);
    await setBotSession(chatId, "leave", "start", { leaveType });
    await sendTelegramMessage(chatId, `Jenis: ${leaveType}\nKirim tanggal mulai (contoh: 2026-09-10 atau 10/09/2026)`);
    return true;
  }
  return false;
}

export async function handleLeaveFlowText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "leave") return false;

  if (session.step === "start") {
    const start = parseDateInput(text);
    if (!start) {
      await sendTelegramMessage(chatId, "Format tanggal salah. Contoh: 10/09/2026");
      return true;
    }
    await patchBotSession(chatId, "end", { startDate: start.toISOString() });
    await sendTelegramMessage(chatId, "Kirim tanggal selesai (contoh: 12/09/2026). Kalau 1 hari, kirim tanggal yang sama.");
    return true;
  }

  if (session.step === "end") {
    const end = parseDateInput(text);
    if (!end) {
      await sendTelegramMessage(chatId, "Format tanggal salah.");
      return true;
    }
    await patchBotSession(chatId, "remarks", { endDate: end.toISOString() });
    await sendTelegramMessage(chatId, "Keterangan singkat? (atau ketik - untuk kosong)");
    return true;
  }

  if (session.step === "remarks") {
    const remarks = text.trim() === "-" ? null : text.trim();
    const leaveType = String(session.data.leaveType || "");
    const startDate = new Date(String(session.data.startDate));
    const endDate = new Date(String(session.data.endDate));
    if (!leaveType || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      await clearBotSession(chatId);
      await sendTelegramMessage(chatId, "Sesi rusak. Ketik /cuti lagi.");
      return true;
    }
    if (endDate < startDate) {
      await sendTelegramMessage(chatId, "Tanggal selesai tidak boleh sebelum mulai.");
      return true;
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        leaveType,
        startDate,
        endDate,
        remarks,
      },
    });
    const needsAtasan = await requiresAtasanApproval(leaveType);
    void notifyLeaveSubmitted({
      id: leave.id,
      leaveType,
      startDate,
      endDate,
      userId: user.id,
      needsAtasan,
    });
    await clearBotSession(chatId);
    await sendTelegramMessage(
      chatId,
      `Cuti diajukan ✅\n${leaveType}\n${startDate.toLocaleDateString("id-ID")} – ${endDate.toLocaleDateString("id-ID")}\nStatus: menunggu persetujuan`
    );
    return true;
  }

  return false;
}

export async function startOvertimeFlow(chatId: string, user: UserRef) {
  if (!hasPermission(user.role, "overtime:submit")) {
    await sendTelegramMessage(chatId, "Anda tidak punya akses ajukan lembur.");
    return;
  }
  if (!user.company) {
    await sendTelegramMessage(chatId, "PT belum di-set. Hubungi HRD.");
    return;
  }
  const policy = await loadPolicy(user.company);
  if (!policy?.overtimeWeekday) {
    await sendTelegramMessage(chatId, "Lembur tidak berlaku untuk perusahaan Anda.");
    return;
  }
  await setBotSession(chatId, "overtime", "date", {});
  await sendTelegramMessage(chatId, "Ajukan lembur\nKirim tanggal lembur (contoh: 05/09/2026)");
}

export async function handleOvertimeFlowText(chatId: string, user: UserRef, text: string) {
  const session = await getBotSession(chatId);
  if (!session || session.flow !== "overtime") return false;

  if (session.step === "date") {
    const date = parseDateInput(text);
    if (!date) {
      await sendTelegramMessage(chatId, "Format tanggal salah.");
      return true;
    }
    await patchBotSession(chatId, "hours", { date: date.toISOString() });
    await sendTelegramMessage(chatId, "Berapa jam lembur? (contoh: 2 atau 2.5)");
    return true;
  }

  if (session.step === "hours") {
    const hours = Number(text.replace(",", "."));
    if (!hours || hours <= 0 || hours > 24) {
      await sendTelegramMessage(chatId, "Jam tidak valid. Contoh: 2");
      return true;
    }
    await patchBotSession(chatId, "desc", { hours });
    await sendTelegramMessage(chatId, "Keterangan lembur? (atau ketik -)");
    return true;
  }

  if (session.step === "desc") {
    const description = text.trim() === "-" ? null : text.trim();
    const date = new Date(String(session.data.date));
    const hours = Number(session.data.hours);
    date.setHours(0, 0, 0, 0);
    const holidays = await prisma.publicHoliday.findMany();
    const holidayDates = new Set(holidays.map((h) => toDateKey(h.date)));
    const resolvedType = resolveOvertimeType(date, holidayDates);

    const overtime = await prisma.overtime.create({
      data: {
        userId: user.id,
        date,
        hours,
        type: resolvedType,
        description,
      },
      include: { user: { select: { name: true, userId: true, company: true } } },
    });
    void notifyOvertimeSubmitted(overtime);
    await clearBotSession(chatId);
    await sendTelegramMessage(
      chatId,
      `Lembur diajukan ✅\n${date.toLocaleDateString("id-ID")} · ${hours} jam · ${resolvedType}\nMenunggu approval`
    );
    return true;
  }

  return false;
}
