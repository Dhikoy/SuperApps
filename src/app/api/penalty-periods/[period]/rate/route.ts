import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setPenaltyRate } from "@/lib/penalty-store";

type Ctx = { params: Promise<{ period: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { period } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const result = await setPenaltyRate(session, period, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
