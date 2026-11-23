import { prisma } from "@/lib/prisma";

const TTL_MS = 15 * 60 * 1000;

export async function getBotSession(chatId: string) {
  const s = await prisma.telegramBotSession.findUnique({ where: { chatId } });
  if (!s) return null;
  if (s.expiresAt < new Date()) {
    await prisma.telegramBotSession.delete({ where: { chatId } }).catch(() => {});
    return null;
  }
  return {
    ...s,
    data: JSON.parse(s.payload || "{}") as Record<string, unknown>,
  };
}

export async function setBotSession(
  chatId: string,
  flow: string,
  step: string,
  data: Record<string, unknown> = {}
) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const payload = JSON.stringify(data);
  await prisma.telegramBotSession.upsert({
    where: { chatId },
    create: { chatId, flow, step, payload, expiresAt },
    update: { flow, step, payload, expiresAt },
  });
}

export async function clearBotSession(chatId: string) {
  await prisma.telegramBotSession.deleteMany({ where: { chatId } });
}

export async function patchBotSession(
  chatId: string,
  step: string,
  patch: Record<string, unknown>
) {
  const cur = await getBotSession(chatId);
  if (!cur) return null;
  const data = { ...cur.data, ...patch };
  await setBotSession(chatId, cur.flow, step, data);
  return data;
}
