import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const exits = await prisma.exitRequest.findMany({
    include: { user: { select: { name: true, company: true, nik: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ exits });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, resignDate, reason } = await request.json();
  if (!userId || !resignDate) {
    return NextResponse.json({ error: "userId dan resignDate wajib" }, { status: 400 });
  }

  const exit = await prisma.exitRequest.create({
    data: {
      userId,
      resignDate: new Date(resignDate),
      reason: reason?.trim() || null,
    },
  });

  return NextResponse.json(exit, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { id, status, clearanceNote } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "id dan status wajib" }, { status: 400 });

  const existing = await prisma.exitRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Exit tidak ditemukan" }, { status: 404 });

  const allowed: Record<string, string[]> = {
    PENDING: ["APPROVED"],
    APPROVED: ["CLEARANCE"],
    CLEARANCE: ["COMPLETED"],
  };
  if (!allowed[existing.status]?.includes(status)) {
    return NextResponse.json({ error: `Tidak bisa ubah status ${existing.status} → ${status}` }, { status: 400 });
  }

  const exit = await prisma.exitRequest.update({
    where: { id },
    data: {
      status,
      clearanceNote: clearanceNote?.trim() || null,
      approvedBy: auth.session!.nik,
      approvedAt: new Date(),
    },
  });

  return NextResponse.json(exit);
}
