import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deletePenalty, updatePenalty } from "@/lib/penalty-store";

type Ctx = { params: Promise<{ id: string }> };

function jsonError(result: { error: string; status: number }) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const result = await updatePenalty(session, id, body);
  if ("error" in result) return jsonError(result);
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const result = await deletePenalty(session, id);
  if ("error" in result) return jsonError(result);
  return NextResponse.json(result);
}
