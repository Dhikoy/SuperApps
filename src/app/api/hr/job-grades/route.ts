import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrApi("hr:view");
  if (auth.error) return auth.error;

  const grades = await prisma.jobGrade.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ company: "asc" }, { grade: "asc" }],
  });

  return NextResponse.json({ grades });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { title, grade, company, minSalary, maxSalary } = await request.json();
  if (!title?.trim() || !grade?.trim()) {
    return NextResponse.json({ error: "Jabatan dan grade wajib" }, { status: 400 });
  }

  const row = await prisma.jobGrade.create({
    data: {
      title: title.trim(),
      grade: grade.trim(),
      company: company?.toUpperCase() || null,
      minSalary: minSalary ? Number(minSalary) : null,
      maxSalary: maxSalary ? Number(maxSalary) : null,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
