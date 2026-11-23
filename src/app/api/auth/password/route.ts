import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Password lama dan baru wajib diisi" }, { status: 400 });
  }

  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { nik: session.nik } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const valid = await verifyPassword(String(currentPassword), user.password);
  if (!valid) {
    return NextResponse.json({ error: "Password saat ini salah" }, { status: 401 });
  }

  await prisma.user.update({
    where: { nik: session.nik },
    data: {
      password: await hashPassword(String(newPassword)),
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
