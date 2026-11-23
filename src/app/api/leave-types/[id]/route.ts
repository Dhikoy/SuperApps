import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LEAVE_TYPES } from "@/lib/leave-types";
import { hasPermission } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LEAVE_NAMES = new Set<string>(DEFAULT_LEAVE_TYPES.map((t) => t.name));

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "settings:manage") && !hasPermission(session.role, "hr:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.leaveType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Jenis cuti tidak ditemukan" }, { status: 404 });
  }

  const type = await prisma.leaveType.update({
    where: { id },
    data: {
      ...(body.name != null ? { name: String(body.name).trim() } : {}),
      ...(body.requiresAtasan != null ? { requiresAtasan: Boolean(body.requiresAtasan) } : {}),
      ...(body.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.sortOrder != null ? { sortOrder: Number(body.sortOrder) } : {}),
    },
  });
  return NextResponse.json(type);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "settings:manage") && !hasPermission(session.role, "hr:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const permanent = request.nextUrl.searchParams.get("permanent") === "1";

  const existing = await prisma.leaveType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Jenis cuti tidak ditemukan" }, { status: 404 });
  }

  if (permanent) {
    if (existing.isActive) {
      return NextResponse.json(
        { error: "Nonaktifkan jenis cuti terlebih dahulu sebelum menghapus permanen" },
        { status: 400 }
      );
    }

    if (DEFAULT_LEAVE_NAMES.has(existing.name)) {
      return NextResponse.json(
        { error: "Jenis cuti default tidak bisa dihapus permanen — cukup nonaktifkan" },
        { status: 400 }
      );
    }

    await prisma.leaveType.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  await prisma.leaveType.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
