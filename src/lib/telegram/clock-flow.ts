import { prisma } from "@/lib/prisma";
import { performClockIn, performClockOut } from "@/lib/attendance-clock";
import {
  downloadTelegramFileAsDataUrl,
  locationKeyboard,
  removeKeyboard,
  sendTelegramMessage,
} from "@/lib/telegram/client";
import { resolvePresensiForUser } from "@/lib/resolve-presensi";
import { allowsShiftSelection, parseShiftOptionIds } from "@/lib/shift-options";

const SESSION_TTL_MS = 10 * 60 * 1000;

type LinkedUser = {
  nik: string;
  id: string;
  name: string;
  role: string;
  company: string | null;
};

async function upsertSession(chatId: string, action: "in" | "out", step: string, extra: Record<string, unknown> = {}) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.telegramClockSession.upsert({
    where: { chatId },
    create: {
      chatId,
      action,
      step,
      expiresAt,
      jamKerjaId: (extra.jamKerjaId as string) ?? null,
      latitude: (extra.latitude as number) ?? null,
      longitude: (extra.longitude as number) ?? null,
    },
    update: {
      action,
      step,
      expiresAt,
      ...(extra.jamKerjaId !== undefined ? { jamKerjaId: extra.jamKerjaId as string | null } : {}),
      ...(extra.latitude !== undefined ? { latitude: extra.latitude as number | null } : {}),
      ...(extra.longitude !== undefined ? { longitude: extra.longitude as number | null } : {}),
    },
  });
}

export async function startClockFlow(chatId: string, user: LinkedUser, action: "in" | "out") {
  if (action === "in") {
    const full = await prisma.user.findUnique({
      where: { nik: user.nik },
      include: { officeLocation: true, workSchedule: true },
    });
    if (full?.company) {
      const companyConfig = await prisma.companyPresensiConfig.findUnique({
        where: { company: full.company },
      });
      const shiftOptionIds = parseShiftOptionIds(companyConfig?.shiftOptions);
      if (allowsShiftSelection(shiftOptionIds)) {
        const schedules = await prisma.workSchedule.findMany({
          where: { id: { in: shiftOptionIds } },
        });
        await upsertSession(chatId, "in", "shift");
        await sendTelegramMessage(
          chatId,
          "Pilih shift dulu, lalu kirim lokasi & foto selfie.",
          {
            reply_markup: {
              inline_keyboard: schedules.map((s) => [
                { text: `${s.shiftName} (${s.standardClockIn}–${s.standardClockOut})`, callback_data: `shift:${s.id}` },
              ]),
            },
          }
        );
        return;
      }
    }
  }

  await upsertSession(chatId, action, "location");
  await sendTelegramMessage(
    chatId,
    action === "in"
      ? "Clock In via Telegram\n1) Ketuk tombol kirim lokasi\n2) Kirim foto selfie"
      : "Clock Out via Telegram\n1) Ketuk tombol kirim lokasi\n2) Kirim foto selfie",
    { reply_markup: locationKeyboard() }
  );
}

export async function handleClockShiftSelect(chatId: string, jamKerjaId: string) {
  const session = await prisma.telegramClockSession.findUnique({ where: { chatId } });
  if (!session || session.expiresAt < new Date()) {
    await sendTelegramMessage(chatId, "Sesi habis. Ketik /clockin lagi.");
    return;
  }
  await upsertSession(chatId, session.action as "in" | "out", "location", { jamKerjaId });
  await sendTelegramMessage(chatId, "Shift dipilih. Sekarang kirim lokasi Anda.", {
    reply_markup: locationKeyboard(),
  });
}

export async function handleClockLocation(chatId: string, latitude: number, longitude: number) {
  const session = await prisma.telegramClockSession.findUnique({ where: { chatId } });
  if (!session || session.expiresAt < new Date() || session.step === "shift") {
    await sendTelegramMessage(chatId, "Sesi tidak aktif. Ketik /clockin atau /clockout.");
    return;
  }
  await upsertSession(chatId, session.action as "in" | "out", "photo", {
    latitude,
    longitude,
    jamKerjaId: session.jamKerjaId,
  });
  await sendTelegramMessage(chatId, "Lokasi diterima. Sekarang kirim foto selfie saja (tanpa caption /clockin).", {
    reply_markup: removeKeyboard(),
  });
}

export async function handleClockPhoto(chatId: string, fileId: string, user: LinkedUser) {
  const session = await prisma.telegramClockSession.findUnique({ where: { chatId } });
  if (!session || session.expiresAt < new Date() || session.step !== "photo") {
    await sendTelegramMessage(chatId, "Kirim /clockin atau /clockout dulu, lalu lokasi, baru foto.");
    return;
  }
  if (session.latitude == null || session.longitude == null) {
    await sendTelegramMessage(chatId, "Lokasi belum ada. Mulai ulang dengan /clockin.");
    return;
  }

  const dataUrl = await downloadTelegramFileAsDataUrl(fileId);
  if (!dataUrl) {
    await sendTelegramMessage(chatId, "Gagal unduh foto. Kirim ulang foto yang lebih kecil.");
    return;
  }

  const result =
    session.action === "in"
      ? await performClockIn({
          userNik: user.nik,
          userId: user.id,
          latitude: session.latitude,
          longitude: session.longitude,
          selfieImage: dataUrl,
          jamKerjaId: session.jamKerjaId,
        })
      : await performClockOut({
          userNik: user.nik,
          userId: user.id,
          latitude: session.latitude,
          longitude: session.longitude,
          selfieImage: dataUrl,
        });

  await prisma.telegramClockSession.delete({ where: { chatId } }).catch(() => {});

  if (!result.ok) {
    await sendTelegramMessage(chatId, `Gagal: ${result.error}`);
    return;
  }

  if (session.action === "in") {
    await sendTelegramMessage(
      chatId,
      `Clock in berhasil ✅\nStatus: ${result.status ?? "HADIR"}\n(Aturan sama seperti di website)`
    );
  } else {
    await sendTelegramMessage(chatId, "Clock out berhasil ✅");
  }
}

export async function getTodayStatusText(user: LinkedUser) {
  const today = (await import("@/lib/timezone")).getJakartaTodayStart();
  const att = await prisma.attendance.findFirst({
    where: { userId: user.id, date: today },
  });
  const full = await prisma.user.findUnique({
    where: { nik: user.nik },
    include: { officeLocation: true, workSchedule: true },
  });
  let shift = "—";
  if (full) {
    const presensi = await resolvePresensiForUser(full);
    shift = `${presensi.schedule?.shiftName ?? "Default"} (${presensi.schedule?.standardClockIn ?? "09:00"}–${presensi.schedule?.standardClockOut ?? "17:00"})`;
  }
  if (!att) return `Belum clock in hari ini.\nShift: ${shift}\nKetik /clockin untuk absen via Telegram.`;
  return (
    `Status hari ini\n` +
    `Masuk: ${att.clockInTime ?? "—"}\n` +
    `Pulang: ${att.clockOutTime ?? "belum"}\n` +
    `Status: ${att.status}\n` +
    `Shift: ${shift}`
  );
}
