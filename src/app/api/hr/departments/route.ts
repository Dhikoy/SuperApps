import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrApi("hr:view");
  if (auth.error) return auth.error;

  const departments = await prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ company: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ departments });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { name, company, headNik, description } = await request.json();
  if (!name?.trim() || !company?.trim()) {
    return NextResponse.json({ error: "Nama dan perusahaan wajib" }, { status: 400 });
  }

  const dept = await prisma.department.create({
    data: {
      name: name.trim(),
      company: company.toUpperCase(),
      headNik: headNik || null,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json(dept, { status: 201 });
}
