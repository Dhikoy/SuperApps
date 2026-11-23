import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { performClockOut } from "@/lib/attendance-clock";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission(session.role, "attendance:clock")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { latitude, longitude, selfieImage } = await request.json();
    const result = await performClockOut({
      userNik: session.nik,
      userId: session.id,
      latitude,
      longitude,
      selfieImage,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json(result.attendance);
  } catch (err) {
    console.error("[POST /api/attendance/clock-out]", err);
    return NextResponse.json({ error: "Gagal menyimpan clock out. Cek log server." }, { status: 500 });
  }
}
