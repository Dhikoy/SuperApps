import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteCompany, canManageCompanies } from "@/lib/roles";

type Params = { params: Promise<{ code: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCompanies(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code } = await params;
  const body = await request.json();

  const existing = await prisma.company.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "PT tidak ditemukan" }, { status: 404 });

  const name = body.name?.trim() ?? existing.name;
  const description =
    body.description !== undefined ? body.description?.trim() || null : existing.description;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive;
  const sortOrder =
    body.sortOrder !== undefined ? Number(body.sortOrder) : existing.sortOrder;

  if (!name) return NextResponse.json({ error: "Nama PT wajib diisi" }, { status: 400 });

  const company = await prisma.company.update({
    where: { code },
    data: { name, description, isActive, sortOrder },
  });

  const employeeCount = await prisma.user.count({
    where: { company: code, role: { not: "SUPER_ADMIN" } },
  });

  return NextResponse.json({ ...company, employeeCount });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteCompany(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code } = await params;

  const employeeCount = await prisma.user.count({ where: { company: code } });
  if (employeeCount > 0) {
    return NextResponse.json(
      { error: `PT ${code} masih punya ${employeeCount} karyawan — nonaktifkan saja` },
      { status: 400 }
    );
  }

  await prisma.company.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
