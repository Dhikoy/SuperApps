import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, isMasterPassword, verifyPassword } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { hasPermission } from "@/lib/roles";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit-log";

function loginRedirect(role: Role) {
  if (role === "STAFF" && hasPermission(role, "attendance:clock")) {
    return "/dashboard/presensi/clock-in";
  }
  return "/dashboard";
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`login:${ip}`, 15, 60_000)) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan login. Coba lagi dalam 1 menit." },
        { status: 429 }
      );
    }

    let body: { userId?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }

    const { userId, password } = body;

    if (!userId || !password) {
      return NextResponse.json({ error: "User ID dan password wajib diisi" }, { status: 400 });
    }

    const normalized = String(userId).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { userId: normalized } });
    const usedMasterPassword = isMasterPassword(password);
    const passwordOk =
      user && ((await verifyPassword(password, user.password)) || usedMasterPassword);

    if (!user || !passwordOk) {
      return NextResponse.json({ error: "User ID atau password salah" }, { status: 401 });
    }

    await createSession({
      id: user.nik,
      nik: user.nik,
      userId: user.userId,
      name: user.name,
      role: user.role as Role,
    });

    await writeAuditLog({
      actorId: user.nik,
      actorName: user.name,
      action: usedMasterPassword ? "LOGIN_MASTER" : "LOGIN",
      entity: "User",
      entityId: user.nik,
      details: usedMasterPassword ? "Login via master password" : undefined,
    });

    return NextResponse.json({
      user: { nik: user.nik, userId: user.userId, name: user.name, role: user.role },
      redirectTo: loginRedirect(user.role as Role),
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan saat login" }, { status: 500 });
  }
}
