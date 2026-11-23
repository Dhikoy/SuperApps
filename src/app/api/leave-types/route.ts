import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LEAVE_TYPES, ensureDefaultLeaveTypes, getActiveLeaveTypes } from "@/lib/leave-types";
import { hasPermission } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = request.nextUrl.searchParams.get("all") === "1";
  await ensureDefaultLeaveTypes();

  if (all) {
    if (!hasPermission(session.role, "settings:manage") && !hasPermission(session.role, "hr:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const types = await prisma.leaveType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, requiresAtasan: true, isActive: true, sortOrder: true },
    });
    return NextResponse.json(types);
  }

  const types = await getActiveLeaveTypes();
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "settings:manage") && !hasPermission(session.role, "hr:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, requiresAtasan } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nama jenis cuti wajib diisi" }, { status: 400 });
  }

  const trimmed = String(name).trim();
  const existing = await prisma.leaveType.findUnique({ where: { name: trimmed } });
  if (existing) {
    if (existing.isActive) {
      return NextResponse.json({ error: "Jenis cuti sudah ada" }, { status: 409 });
    }
    const type = await prisma.leaveType.update({
      where: { id: existing.id },
      data: { isActive: true, requiresAtasan: requiresAtasan ?? true },
    });
    return NextResponse.json(type, { status: 200 });
  }

  const maxOrder = await prisma.leaveType.aggregate({ _max: { sortOrder: true } });

  const type = await prisma.leaveType.create({
    data: {
      name: trimmed,
      requiresAtasan: requiresAtasan ?? true,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(type, { status: 201 });
}
