import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { penaltySummary } from "@/lib/penalty-store";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const period = request.nextUrl.searchParams.get("period") ?? "";
  const company = request.nextUrl.searchParams.get("company");
  const result = await penaltySummary(session, period, company);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
