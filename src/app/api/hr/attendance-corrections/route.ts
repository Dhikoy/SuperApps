import { NextRequest, NextResponse } from "next/server";
import { requireHrApi } from "@/lib/hr-auth";
import {
  canReviewAttendanceCorrection,
  listAttendanceCorrections,
  reviewAttendanceCorrection,
} from "@/lib/attendance-correction";
import type { Role } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const items = await listAttendanceCorrections(status || undefined);
  return NextResponse.json({ items });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const session = auth.session!;
  if (!canReviewAttendanceCorrection(session.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, action } = await request.json();
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id dan action (approve|reject) wajib" }, { status: 400 });
  }

  const result = await reviewAttendanceCorrection(
    id,
    { nik: session.nik, role: session.role as Role, name: session.name },
    action === "approve"
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
