import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { lastPosSyncLogs, runPosSync } from "@/lib/pos-sync";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ outlets: await lastPosSyncLogs() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { days?: unknown; outlet?: unknown };
  const days = Number(body.days ?? 3);
  const outlet = typeof body.outlet === "string" && body.outlet ? body.outlet : undefined;
  const results = await runPosSync({ days: Number.isFinite(days) ? days : 3, outlet });
  if (results.length === 0) {
    return NextResponse.json({ error: "Belum ada outlet POS yang dikonfigurasi" }, { status: 400 });
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
