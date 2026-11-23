import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { hasPermission } from "@/lib/roles";
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  sendTelegramMessage,
  appBaseUrl,
} from "@/lib/telegram/client";
import { consumeTelegramLinkCode, unlinkTelegram } from "@/lib/telegram/link";
import {
  approveFundViaTelegram,
  approveLeaveViaTelegram,
  approveOvertimeViaTelegram,
} from "@/lib/telegram/approvals";
import {
  getTodayStatusText,
  handleClockLocation,
  handleClockPhoto,
  handleClockShiftSelect,
  startClockFlow,
} from "@/lib/telegram/clock-flow";
import { sendPendingList, sendSlipCommand } from "@/lib/telegram/commands";
import { sendMainMenu } from "@/lib/telegram/menu";
import {
  handleLeaveFlowCallback,
  handleLeaveFlowText,
  handleOvertimeFlowText,
  startLeaveFlow,
  startOvertimeFlow,
} from "@/lib/telegram/flows-leave-ot";
import {
  sendCutiBalance,
  sendHariIni,
  sendMyTasks,
  sendOnboarding,
} from "@/lib/telegram/digest";
import { sendSlipPdf } from "@/lib/telegram/slip-pdf";
import {
  approveBusinessTripViaTelegram,
  broadcastToLinkedUsers,
} from "@/lib/telegram/extras";
import { clearBotSession, getBotSession, setBotSession } from "@/lib/telegram/bot-session";
import {
  approveCorrectionViaTelegram,
  handleCorrectionText,
  handleFundText,
  handleLatePermitText,
  handlePayFundPhoto,
  handlePayFundText,
  handlePayPick,
  handleTaskPick,
  handleTaskProgressText,
  handleTripText,
  sendWeekSchedule,
  sendWeeklyHrReport,
  startCorrectionFlow,
  startLatePermit,
  startPayFundFlow,
  startSimpleFund,
  startTaskProgressFlow,
  startTripFlow,
} from "@/lib/telegram/phase2";

type TgUser = { id: number; username?: string; first_name?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
  caption?: string;
  location?: { latitude: number; longitude: number };
  photo?: { file_id: string }[];
  document?: { file_id: string; mime_type?: string };
};
type TgCallback = {
  id: string;
  from: TgUser;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
};
type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback };

type LinkedUser = {
  nik: string;
  id: string;
  name: string;
  role: Role;
  company: string | null;
};

const HELP =
  `SuperApps BCI Bot\n\n` +
  `/menu — menu tombol\n` +
  `/hariini /jadwal /status\n` +
  `/clockin /clockout /koreksi /izintelat\n` +
  `/cuti /sisacuti /lembur /dinas\n` +
  `/slip /tasks /taskprog /onboarding /dana\n` +
  `/pending /bayardana /laporan /broadcast\n` +
  `/batal /unlink /help\n\n` +
  `Web: ${appBaseUrl()}`;

async function resolveUser(chatId: string): Promise<LinkedUser | null> {
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
    select: { nik: true, name: true, role: true, company: true, userId: true },
  });
  if (!user) return null;
  return {
    nik: user.nik,
    id: user.nik,
    name: user.name,
    role: user.role as Role,
    company: user.company,
  };
}

export async function handleTelegramUpdate(update: TgUpdate) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  if (update.message) await handleMessage(update.message);
}

async function handleCallback(cb: TgCallback) {
  const chatId = String(cb.message?.chat.id ?? cb.from.id);
  const data = cb.data ?? "";
  const user = await resolveUser(chatId);

  if (data.startsWith("shift:")) {
    if (!user) {
      await answerCallbackQuery(cb.id, "Hubungkan akun dulu");
      return;
    }
    await handleClockShiftSelect(chatId, data.slice(6));
    await answerCallbackQuery(cb.id, "Shift dipilih");
    return;
  }

  if (data.startsWith("lvflow:")) {
    if (!user) {
      await answerCallbackQuery(cb.id, "Hubungkan akun dulu");
      return;
    }
    await handleLeaveFlowCallback(chatId, user, data);
    await answerCallbackQuery(cb.id);
    return;
  }

  if (data.startsWith("tpick:")) {
    if (!user) {
      await answerCallbackQuery(cb.id, "Hubungkan akun dulu");
      return;
    }
    await handleTaskPick(chatId, data.slice(6));
    await answerCallbackQuery(cb.id);
    return;
  }

  if (data.startsWith("paypick:")) {
    if (!user) {
      await answerCallbackQuery(cb.id, "Hubungkan akun dulu");
      return;
    }
    await handlePayPick(chatId, data.slice(8));
    await answerCallbackQuery(cb.id);
    return;
  }

  if (data.startsWith("menu:")) {
    if (!user) {
      await answerCallbackQuery(cb.id, "Hubungkan akun dulu");
      return;
    }
    await answerCallbackQuery(cb.id);
    await routeMenu(chatId, user, data.slice(5));
    return;
  }

  if (!user) {
    await answerCallbackQuery(cb.id, "Hubungkan akun dulu di Profil web");
    return;
  }

  const actor = { nik: user.nik, id: user.id, name: user.name, role: user.role };
  const [kind, action, id] = data.split(":");
  let result: { ok: boolean; error?: string; message?: string } = {
    ok: false,
    error: "Aksi tidak dikenal",
  };

  if (kind === "ot" && id) result = await approveOvertimeViaTelegram(id, actor, action === "ok");
  else if (kind === "lv" && id) result = await approveLeaveViaTelegram(id, actor, action === "ok");
  else if (kind === "fn" && id) result = await approveFundViaTelegram(id, actor, action === "ok");
  else if (kind === "bt" && id)
    result = await approveBusinessTripViaTelegram(id, actor, action === "ok");
  else if (kind === "ac" && id)
    result = await approveCorrectionViaTelegram(id, actor, action === "ok");

  await answerCallbackQuery(cb.id, result.ok ? result.message : result.error);
  if (result.ok && cb.message) {
    await editMessageReplyMarkup(chatId, cb.message.message_id);
    await sendTelegramMessage(chatId, result.message ?? "OK");
  } else if (!result.ok && result.error) {
    await sendTelegramMessage(chatId, result.error);
  }
}

async function routeMenu(chatId: string, user: LinkedUser, key: string) {
  switch (key) {
    case "clockin":
      return startClockFlow(chatId, user, "in");
    case "clockout":
      return startClockFlow(chatId, user, "out");
    case "hariini":
      return sendHariIni(chatId, user);
    case "status":
      return sendTelegramMessage(chatId, await getTodayStatusText(user));
    case "cuti":
      return startLeaveFlow(chatId, user);
    case "lembur":
      return startOvertimeFlow(chatId, user);
    case "sisacuti":
      return sendCutiBalance(chatId, user.nik);
    case "slip":
      await sendSlipCommand(user.nik, chatId);
      return sendSlipPdf(user.nik, chatId);
    case "onboarding":
      return sendOnboarding(chatId, user.nik);
    case "tasks":
      return sendMyTasks(chatId, user.nik);
    case "pending":
      return sendPendingList(chatId, user.role);
    case "broadcast":
      return startBroadcast(chatId, user);
    case "koreksi":
      return startCorrectionFlow(chatId, user);
    case "izintelat":
      return startLatePermit(chatId, user);
    case "jadwal":
      return sendWeekSchedule(chatId, user);
    case "dinas":
      return startTripFlow(chatId, user);
    case "taskprog":
      return startTaskProgressFlow(chatId, user);
    case "dana":
      return startSimpleFund(chatId, user);
    case "bayardana":
      return startPayFundFlow(chatId, user);
    case "laporan":
      return sendWeeklyHrReport(chatId, user);
    case "help":
      return sendTelegramMessage(chatId, HELP);
    default:
      return sendMainMenu(chatId, user.role, user.name);
  }
}

async function startBroadcast(chatId: string, user: LinkedUser) {
  if (!hasPermission(user.role, "hr:manage")) {
    await sendTelegramMessage(chatId, "Hanya HRD/admin yang bisa broadcast.");
    return;
  }
  await setBotSession(chatId, "broadcast", "message", {});
  await sendTelegramMessage(chatId, "Kirim isi pengumuman (satu pesan). Ketik /batal untuk batal.");
}

async function handleMessage(msg: TgMessage) {
  const chatId = String(msg.chat.id);
  const text = (msg.text || "").trim();

  if (msg.location) {
    const user = await resolveUser(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, "Hubungkan akun dulu. Buka Profil → Hubungkan Telegram.");
      return;
    }
    await handleClockLocation(chatId, msg.location.latitude, msg.location.longitude);
    return;
  }

  if (msg.photo?.length) {
    const user = await resolveUser(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, "Hubungkan akun dulu.");
      return;
    }
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    if (await handlePayFundPhoto(chatId, user, fileId)) return;
    await handleClockPhoto(chatId, fileId, user);
    return;
  }

  if (msg.document?.mime_type?.startsWith("image/")) {
    const user = await resolveUser(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, "Hubungkan akun dulu.");
      return;
    }
    await handleClockPhoto(chatId, msg.document.file_id, user);
    return;
  }

  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const code = parts[1]?.trim();
    if (!code) {
      const linked = await resolveUser(chatId);
      if (linked) {
        await sendTelegramMessage(chatId, `Sudah terhubung sebagai ${linked.name}.`);
        await sendMainMenu(chatId, linked.role, linked.name);
      } else {
        await sendTelegramMessage(
          chatId,
          `Halo! Hubungkan akun SuperApps dulu.\n1. Login web → Profil Saya\n2. Ketuk Hubungkan Telegram\n3. Buka link / kirim /start KODE\n\n${HELP}`
        );
      }
      return;
    }
    const result = await consumeTelegramLinkCode(code, chatId, msg.from?.username);
    if (!result.ok) {
      await sendTelegramMessage(chatId, result.error);
      return;
    }
    const linked = await resolveUser(chatId);
    await sendTelegramMessage(
      chatId,
      `Terhubung ✅\nHalo ${result.user?.name} (NIK ${result.user?.nik}).`
    );
    if (linked) await sendMainMenu(chatId, linked.role, linked.name);
    return;
  }

  const user = await resolveUser(chatId);
  if (text === "/batal" || text.toLowerCase() === "batal") {
    await clearBotSession(chatId);
    await sendTelegramMessage(chatId, "Dibatalkan.");
    return;
  }

  if (user) {
    if (await handleLeaveFlowText(chatId, user, text)) return;
    if (await handleOvertimeFlowText(chatId, user, text)) return;
    if (await handleCorrectionText(chatId, user, text)) return;
    if (await handleLatePermitText(chatId, user, text)) return;
    if (await handleTripText(chatId, user, text)) return;
    if (await handleTaskProgressText(chatId, user, text)) return;
    if (await handleFundText(chatId, user, text)) return;
    if (await handlePayFundText(chatId, user, text)) return;
    const session = await getBotSession(chatId);
    if (session?.flow === "broadcast" && session.step === "message") {
      if (!hasPermission(user.role, "hr:manage")) {
        await clearBotSession(chatId);
        return;
      }
      const n = await broadcastToLinkedUsers(text, user.nik);
      await clearBotSession(chatId);
      await sendTelegramMessage(chatId, `Broadcast terkirim ke ${n} karyawan terhubung.`);
      return;
    }
  }

  const cmd = text.split(/\s+/)[0]?.toLowerCase().replace(/@\w+$/, "");

  if (cmd === "/help") {
    await sendTelegramMessage(chatId, HELP);
    return;
  }

  if (!user) {
    await sendTelegramMessage(chatId, "Akun belum terhubung. Buat kode di Profil web, lalu /start KODE");
    return;
  }

  if (cmd === "/menu") {
    await sendMainMenu(chatId, user.role, user.name);
    return;
  }
  if (cmd === "/hariini") {
    await sendHariIni(chatId, user);
    return;
  }
  if (cmd === "/clockin") {
    if (!hasPermission(user.role, "attendance:clock")) {
      await sendTelegramMessage(chatId, "Tidak punya akses clock-in.");
      return;
    }
    await startClockFlow(chatId, user, "in");
    return;
  }
  if (cmd === "/clockout") {
    if (!hasPermission(user.role, "attendance:clock")) {
      await sendTelegramMessage(chatId, "Tidak punya akses clock-out.");
      return;
    }
    await startClockFlow(chatId, user, "out");
    return;
  }
  if (cmd === "/status") {
    await sendTelegramMessage(chatId, await getTodayStatusText(user));
    return;
  }
  if (cmd === "/cuti") {
    await startLeaveFlow(chatId, user);
    return;
  }
  if (cmd === "/sisacuti") {
    await sendCutiBalance(chatId, user.nik);
    return;
  }
  if (cmd === "/lembur") {
    await startOvertimeFlow(chatId, user);
    return;
  }
  if (cmd === "/slip") {
    await sendSlipCommand(user.nik, chatId);
    await sendSlipPdf(user.nik, chatId);
    return;
  }
  if (cmd === "/tasks") {
    await sendMyTasks(chatId, user.nik);
    return;
  }
  if (cmd === "/onboarding") {
    await sendOnboarding(chatId, user.nik);
    return;
  }
  if (cmd === "/pending") {
    await sendPendingList(chatId, user.role);
    return;
  }
  if (cmd === "/broadcast") {
    await startBroadcast(chatId, user);
    return;
  }
  if (cmd === "/koreksi") {
    await startCorrectionFlow(chatId, user);
    return;
  }
  if (cmd === "/izintelat") {
    await startLatePermit(chatId, user);
    return;
  }
  if (cmd === "/jadwal") {
    await sendWeekSchedule(chatId, user);
    return;
  }
  if (cmd === "/dinas") {
    await startTripFlow(chatId, user);
    return;
  }
  if (cmd === "/taskprog") {
    await startTaskProgressFlow(chatId, user);
    return;
  }
  if (cmd === "/dana") {
    await startSimpleFund(chatId, user);
    return;
  }
  if (cmd === "/bayardana") {
    await startPayFundFlow(chatId, user);
    return;
  }
  if (cmd === "/laporan") {
    await sendWeeklyHrReport(chatId, user);
    return;
  }
  if (cmd === "/unlink") {
    await unlinkTelegram(user.nik);
    await sendTelegramMessage(chatId, "Tautan Telegram diputus.");
    return;
  }

  await sendTelegramMessage(chatId, `Perintah tidak dikenal.\n\n${HELP}`, {
    reply_markup: (await import("@/lib/telegram/menu")).mainMenuKeyboard(user.role),
  });
}
