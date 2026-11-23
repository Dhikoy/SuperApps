import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTelegramLinkCode, unlinkTelegram } from "@/lib/telegram/link";
import { getTelegramBotUsername, isTelegramConfigured } from "@/lib/telegram/client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { nik: session.nik },
    select: {
      telegramChatId: true,
      telegramUsername: true,
      telegramLinkedAt: true,
    },
  });

  return NextResponse.json({
    configured: isTelegramConfigured(),
    botUsername: getTelegramBotUsername() || null,
    linked: Boolean(user?.telegramChatId),
    telegramUsername: user?.telegramUsername ?? null,
    telegramLinkedAt: user?.telegramLinkedAt ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: "Bot Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN)." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action === "unlink") {
    await unlinkTelegram(session.nik);
    return NextResponse.json({ ok: true, linked: false });
  }

  const link = await createTelegramLinkCode(session.nik);
  return NextResponse.json(link);
}
