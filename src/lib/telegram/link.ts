import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getTelegramBotUsername } from "@/lib/telegram/client";

const LINK_TTL_MS = 10 * 60 * 1000;

export async function createTelegramLinkCode(userId: string) {
  await prisma.telegramLinkCode.deleteMany({
    where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] },
  });

  const code = randomBytes(4).toString("hex");
  const record = await prisma.telegramLinkCode.create({
    data: {
      code,
      userId,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });

  const bot = getTelegramBotUsername();
  const deepLink = bot ? `https://t.me/${bot}?start=${code}` : null;

  return { code: record.code, expiresAt: record.expiresAt, deepLink, botUsername: bot || null };
}

export async function consumeTelegramLinkCode(code: string, chatId: string, username?: string | null) {
  const record = await prisma.telegramLinkCode.findUnique({ where: { code } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.telegramLinkCode.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false as const, error: "Kode kedaluwarsa atau tidak valid. Buat kode baru di Profil web." };
  }

  const existing = await prisma.user.findFirst({
    where: { telegramChatId: chatId, NOT: { nik: record.userId } },
  });
  if (existing) {
    return { ok: false as const, error: "Akun Telegram ini sudah terhubung ke karyawan lain." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { nik: record.userId },
      data: {
        telegramChatId: chatId,
        telegramUsername: username ?? null,
        telegramLinkedAt: new Date(),
      },
    }),
    prisma.telegramLinkCode.delete({ where: { id: record.id } }),
  ]);

  const user = await prisma.user.findUnique({
    where: { nik: record.userId },
    select: { name: true, nik: true },
  });

  return { ok: true as const, user };
}

export async function unlinkTelegram(userId: string) {
  const user = await prisma.user.findUnique({
    where: { nik: userId },
    select: { telegramChatId: true },
  });

  await prisma.user.update({
    where: { nik: userId },
    data: {
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
    },
  });
  await prisma.telegramLinkCode.deleteMany({ where: { userId } });
  if (user?.telegramChatId) {
    await prisma.telegramClockSession.deleteMany({ where: { chatId: user.telegramChatId } });
  }
}
