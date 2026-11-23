import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { performClockIn } from "@/lib/attendance-clock";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission(session.role, "attendance:clock")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { latitude, longitude, jamKerjaId, selfieImage } = await request.json();
    const result = await performClockIn({
      userNik: session.nik,
      userId: session.id,
      latitude,
      longitude,
      selfieImage,
      jamKerjaId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json(result.attendance, { status: 201 });
  } catch (err) {
    console.error("[POST /api/attendance/clock]", err);
    return NextResponse.json({ error: "Gagal menyimpan presensi. Cek log server." }, { status: 500 });
  }
}
