import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi } from "@/lib/hr-auth";
import { wouldCreateSupervisorCycle } from "@/lib/supervisor";

export async function GET() {
  const auth = await requireHrApi("hr:view");
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    where: { role: { not: "SUPER_ADMIN" } },
    select: {
      nik: true,
      name: true,
      company: true,
      jobTitle: true,
      role: true,
      supervisorId: true,
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { nik, supervisorId } = await request.json();
  if (!nik) return NextResponse.json({ error: "nik wajib" }, { status: 400 });

  const nextSupervisor = supervisorId || null;
  if (await wouldCreateSupervisorCycle(nik, nextSupervisor)) {
    return NextResponse.json(
      { error: "Penetapan atasan ini akan membuat siklus hierarki. Pilih atasan lain." },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { nik },
    data: { supervisorId: nextSupervisor },
    select: { nik: true, name: true, supervisorId: true },
  });

  return NextResponse.json(user);
}
