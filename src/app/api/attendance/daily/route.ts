import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { buildDailyAttendanceReport } from "@/lib/daily-attendance-report";
import { getJakartaTodayStart } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "attendance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam ? getJakartaTodayStart(new Date(`${dateParam}T12:00:00+07:00`)) : getJakartaTodayStart();

  const canSeeAll = hasPermission(session.role, "attendance:manage");
  const report = await buildDailyAttendanceReport(date, {
    userId: canSeeAll ? undefined : session.nik,
  });

  return NextResponse.json({ ...report, canSeeAll });
}
