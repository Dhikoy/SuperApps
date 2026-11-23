import { NextRequest, NextResponse } from "next/server";
import { runPosSync } from "@/lib/pos-sync";

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
  const days = Number(request.nextUrl.searchParams.get("days") ?? 3);
  const results = await runPosSync({ days: Number.isFinite(days) ? days : 3 });
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
