import { NextRequest, NextResponse } from "next/server";
import { runAllTelegramJobs } from "@/lib/telegram/reminders";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  const q = request.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || q === secret;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runAllTelegramJobs();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
