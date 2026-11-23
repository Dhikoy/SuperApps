import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { syncAllApprovedLeaves } from "@/lib/leave-attendance-sync";
import { syncAlphaAttendance } from "@/lib/attendance-alpha";
import { getCalendarMonthForDate } from "@/lib/period";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "attendance:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const period = getCalendarMonthForDate();
  const year = body.year ?? period.year;
  const month = body.month ?? period.month;

  const leaveResult = await syncAllApprovedLeaves();
  const alphaResult = await syncAlphaAttendance({ year, month });

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "SYNC_ATTENDANCE",
    entity: "Attendance",
    details: `IZIN: ${leaveResult.synced}, ALPHA: ${alphaResult.created}`,
  });

  return NextResponse.json({
    leave: leaveResult,
    alpha: alphaResult,
  });
}
