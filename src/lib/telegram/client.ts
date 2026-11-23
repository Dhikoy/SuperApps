const TELEGRAM_API = "https://api.telegram.org";

export function getTelegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function getTelegramBotUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
}

export function isTelegramConfigured() {
  return Boolean(getTelegramToken());
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.APP_URL || "https://appsbci.com").replace(/\/$/, "");
}

type InlineButton = { text: string; callback_data?: string; url?: string };
type ReplyKeyboardButton = { text: string; request_location?: boolean };

export type TelegramSendOpts = {
  parse_mode?: "HTML" | "Markdown";
  reply_markup?: {
    inline_keyboard?: InlineButton[][];
    keyboard?: ReplyKeyboardButton[][];
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    remove_keyboard?: boolean;
  };
};

async function telegramCall<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = getTelegramToken();
  if (!token) {
    console.info("[telegram:skipped]", method, body.chat_id);
    return null;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      console.error("[telegram:error]", method, data.description);
      return null;
    }
    return data.result ?? null;
  } catch (err) {
    console.error("[telegram:error]", method, err);
    return null;
  }
}

export async function sendTelegramMessage(chatId: string, text: string, opts: TelegramSendOpts = {}) {
  return telegramCall("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...opts,
  });
}

export async function sendTelegramDocument(
  chatId: string,
  filename: string,
  buffer: Buffer,
  caption?: string
) {
  const token = getTelegramToken();
  if (!token) return null;
  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption.slice(0, 1000));
  form.append("document", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendDocument`, { method: "POST", body: form });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error("[telegram:error] sendDocument", data.description);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[telegram:error] sendDocument", err);
    return null;
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegramCall("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text?.slice(0, 200),
    show_alert: Boolean(text && text.length > 40),
  });
}

export async function editMessageReplyMarkup(chatId: string, messageId: number) {
  return telegramCall("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function downloadTelegramFileAsDataUrl(fileId: string): Promise<string | null> {
  const token = getTelegramToken();
  if (!token) return null;

  const file = await telegramCall<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file?.file_path) return null;

  const res = await fetch(`${TELEGRAM_API}/file/bot${token}/${file.file_path}`);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) return null;
  if (buf.length > 1_800_000) return null;

  // Telegram sering kirim Content-Type non-image (octet-stream) — paksa image/*
  const headerType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const path = file.file_path.toLowerCase();
  let mime = "image/jpeg";
  if (headerType.startsWith("image/")) mime = headerType;
  else if (path.endsWith(".png")) mime = "image/png";
  else if (path.endsWith(".webp")) mime = "image/webp";
  else if (path.endsWith(".gif")) mime = "image/gif";

  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function approveKeyboard(prefix: string, id: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Setujui", callback_data: `${prefix}:ok:${id}` },
        { text: "❌ Tolak", callback_data: `${prefix}:no:${id}` },
      ],
    ],
  };
}

export function locationKeyboard() {
  return {
    keyboard: [[{ text: "📍 Kirim lokasi saya", request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function removeKeyboard() {
  return { remove_keyboard: true };
}
