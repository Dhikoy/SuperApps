import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { depreciationSchedule, postDepreciation } from "@/lib/accounting/depreciation";

function parsePeriod(yearRaw: unknown, monthRaw: unknown) {
  const now = new Date();
  const year = Number(yearRaw) || now.getFullYear();
  const month = Number(monthRaw) || now.getMonth() + 1;
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = request.nextUrl.searchParams;
  const period = parsePeriod(params.get("year"), params.get("month"));
  if (!period) return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  const company = (params.get("company") ?? "").trim().toUpperCase() || null;
  return NextResponse.json(await depreciationSchedule(period.year, period.month, company));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const period = parsePeriod(body.year, body.month);
  if (!period) return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  const company = typeof body.company === "string" && body.company.trim() ? body.company.trim().toUpperCase() : null;
  const results = await postDepreciation(period.year, period.month, company, session.nik);
  if (results.length === 0) {
    return NextResponse.json({ error: "Belum ada aset dengan data penyusutan lengkap" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, results });
}
