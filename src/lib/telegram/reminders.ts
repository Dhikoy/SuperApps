import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CLOCK_IN,
  DEFAULT_CLOCK_OUT,
  LATE_TOLERANCE_MINUTES,
  timeToMinutes,
} from "@/lib/attendance-time";
import { resolvePresensiForUser, standardClockInFromConfig } from "@/lib/resolve-presensi";
import { getJakartaClockTime, getJakartaTodayStart } from "@/lib/timezone";
import { appBaseUrl, sendTelegramMessage } from "@/lib/telegram/client";
import { hasPermission, type Role } from "@/lib/roles";

function dateKeyJakarta(d = new Date()) {
  return getJakartaTodayStart(d).toISOString().slice(0, 10);
}

async function alreadySent(userId: string, kind: string) {
  const key = dateKeyJakarta();
  const existing = await prisma.telegramReminderLog.findUnique({
    where: { userId_dateKey_kind: { userId, dateKey: key, kind } },
  });
  return Boolean(existing);
}

async function markSent(userId: string, kind: string) {
  const key = dateKeyJakarta();
  await prisma.telegramReminderLog.create({
    data: { userId, dateKey: key, kind },
  }).catch(() => {});
}

export async function runTelegramAttendanceReminders() {
  const nowMin = timeToMinutes(getJakartaClockTime());
  const today = getJakartaTodayStart();
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    include: { officeLocation: true, workSchedule: true },
  });

  let sent = 0;

  for (const user of users) {
    if (!user.telegramChatId) continue;
    if (!hasPermission(user.role as Role, "attendance:clock")) continue;

    const presensi = await resolvePresensiForUser(user);
    const clockIn = standardClockInFromConfig(presensi.schedule) || DEFAULT_CLOCK_IN;
    const clockOut = presensi.schedule?.standardClockOut || DEFAULT_CLOCK_OUT;
    const clockInMin = timeToMinutes(clockIn);
    const clockOutMin = timeToMinutes(clockOut);
    const lateMin = clockInMin + LATE_TOLERANCE_MINUTES;

    const attendance = await prisma.attendance.findFirst({
      where: { userId: user.nik, date: today },
    });

    // H-30 multi-shift: minta konfirmasi / pilih shift
    if (!attendance && nowMin >= clockInMin - 30 && nowMin < clockInMin - 28) {
      if (!(await alreadySent(user.nik, "shift_confirm"))) {
        const companyConfig = user.company
          ? await prisma.companyPresensiConfig.findUnique({ where: { company: user.company } })
          : null;
        const { allowsShiftSelection, parseShiftOptionIds } = await import("@/lib/shift-options");
        const ids = parseShiftOptionIds(companyConfig?.shiftOptions);
        if (allowsShiftSelection(ids)) {
          const schedules = await prisma.workSchedule.findMany({ where: { id: { in: ids } } });
          await sendTelegramMessage(
            user.telegramChatId,
            `📅 Konfirmasi shift hari ini (masuk ${clockIn}). Pilih shift lalu /clockin saat tiba di kantor.`,
            {
              reply_markup: {
                inline_keyboard: schedules.map((s) => [
                  {
                    text: `${s.shiftName} (${s.standardClockIn}–${s.standardClockOut})`,
                    callback_data: `shift:${s.id}`,
                  },
                ]),
              },
            }
          );
        } else {
          await sendTelegramMessage(
            user.telegramChatId,
            `📅 Reminder: shift hari ini ${clockIn}–${clockOut}. Siap clock-in dengan /clockin`
          );
        }
        await markSent(user.nik, "shift_confirm");
        sent++;
      }
    }

    // H-5 clock-in
    if (!attendance && nowMin >= clockInMin - 5 && nowMin < clockInMin) {
      if (!(await alreadySent(user.nik, "pre_clock_in"))) {
        await sendTelegramMessage(
          user.telegramChatId,
          `⏰ 5 menit lagi jam masuk (${clockIn}).\nClock in via bot: /clockin\nAtau web: ${appBaseUrl()}/dashboard/presensi/clock-in`
        );
        await markSent(user.nik, "pre_clock_in");
        sent++;
      }
    }

    // Late / belum clock-in setelah toleransi
    if (!attendance && nowMin >= lateMin && nowMin < lateMin + 2) {
      if (!(await alreadySent(user.nik, "late"))) {
        await sendTelegramMessage(
          user.telegramChatId,
          `⚠️ Anda belum clock in dan sudah melewati toleransi telat (${LATE_TOLERANCE_MINUTES} menit setelah ${clockIn}).\nSegera /clockin atau absen di web.`
        );
        await markSent(user.nik, "late");
        sent++;
      }
    }

    // H-5 clock-out
    if (attendance && !attendance.clockOutTime && nowMin >= clockOutMin - 5 && nowMin < clockOutMin) {
      if (!(await alreadySent(user.nik, "pre_clock_out"))) {
        await sendTelegramMessage(
          user.telegramChatId,
          `🏠 5 menit lagi jam pulang (${clockOut}).\nJangan lupa /clockout`
        );
        await markSent(user.nik, "pre_clock_out");
        sent++;
      }
    }

    // Belum clock-out 30 menit setelah jam pulang
    if (attendance && !attendance.clockOutTime && nowMin >= clockOutMin + 30 && nowMin < clockOutMin + 32) {
      if (!(await alreadySent(user.nik, "missed_clock_out"))) {
        await sendTelegramMessage(
          user.telegramChatId,
          `⚠️ Belum clock out padahal sudah lewat jam pulang (${clockOut}).\nKetik /clockout sekarang.`
        );
        await markSent(user.nik, "missed_clock_out");
        sent++;
      }
    }
  }

  return { sent, checked: users.length };
}

/** Semua job cron telegram (absensi + digest + stok + aset) */
export async function runAllTelegramJobs() {
  const nowMin = timeToMinutes(getJakartaClockTime());
  const attendance = await runTelegramAttendanceReminders();

  let digestSent = 0;
  // Digest pagi ~07:00–07:02 WIB
  if (nowMin >= 7 * 60 && nowMin < 7 * 60 + 2) {
    const { sendMorningDigests } = await import("@/lib/telegram/digest");
    digestSent = await sendMorningDigests();
  }

  let stockSent = 0;
  let assetSent = 0;
  let hrLifeSent = 0;
  let assetHSent = 0;
  // Stok + aset + HR life events ~08:00
  if (nowMin >= 8 * 60 && nowMin < 8 * 60 + 2) {
    const { runStockLowAlerts, runDigitalAssetDueReminders } = await import("@/lib/telegram/extras");
    const { runHrLifeEventReminders, runDigitalAssetDueH7H1 } = await import("@/lib/telegram/phase2");
    stockSent = await runStockLowAlerts();
    assetSent = await runDigitalAssetDueReminders();
    hrLifeSent = await runHrLifeEventReminders();
    assetHSent = await runDigitalAssetDueH7H1();
  }

  return {
    ...attendance,
    digestSent,
    stockSent,
    assetSent,
    hrLifeSent,
    assetHSent,
  };
}
