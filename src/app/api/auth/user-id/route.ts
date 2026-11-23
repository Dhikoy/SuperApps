import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserIdForUpdate } from "@/lib/user-id-server";
import type { Role } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newUserId, password } = await request.json();

  if (!newUserId?.trim() || !password) {
    return NextResponse.json({ error: "User ID baru dan password wajib diisi" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { nik: session.nik } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const valid = await verifyPassword(String(password), user.password);
  if (!valid) {
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }

  const resolved = await resolveUserIdForUpdate(String(newUserId), session.nik);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  if (resolved.userId === user.userId) {
    return NextResponse.json({ error: "User ID sama dengan yang sekarang" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { nik: session.nik },
    data: { userId: resolved.userId },
    select: { nik: true, userId: true, name: true, role: true },
  });

  await createSession({
    id: updated.nik,
    nik: updated.nik,
    userId: updated.userId,
    name: updated.name,
    role: updated.role as Role,
  });

  return NextResponse.json({ ok: true, userId: updated.userId });
}
