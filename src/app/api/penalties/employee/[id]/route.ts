import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { penaltyEmployeeDetail } from "@/lib/penalty-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const period = request.nextUrl.searchParams.get("period") ?? "";
  const result = await penaltyEmployeeDetail(session, id, period);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
