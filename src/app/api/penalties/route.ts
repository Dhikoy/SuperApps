import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPenalty, listPenaltiesByDate } from "@/lib/penalty-store";

function jsonError(result: { error: string; status: number }) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const result = await listPenaltiesByDate(session, date);
  if ("error" in result) return jsonError(result);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = await createPenalty(session, body);
  if ("error" in result) return jsonError(result);
  return NextResponse.json(result, { status: 201 });
}
