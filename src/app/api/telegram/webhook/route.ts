import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/webhook-handler";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const q = request.nextUrl.searchParams.get("secret");
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  return q === secret || header === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await request.json();
    await handleTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram:webhook]", err);
    return NextResponse.json({ ok: true });
  }
}
