import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";
import { calcBpjsContribution } from "@/lib/bpjs";
import { hasPermission } from "@/lib/roles";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const enrollments = await prisma.bpjsEnrollment.findMany({
    include: {
      user: {
        select: {
          name: true,
          company: true,
          salaries: { orderBy: { effectiveFrom: "desc" }, take: 1 },
        },
      },
    },
  });

  const canSeeSalary = hasPermission(auth.session.role, "payroll:view");
  const rows = enrollments.map(({ user: { salaries, ...user }, ...e }) => {
    if (!canSeeSalary) return { ...e, user, gajiPokok: null, calc: null };
    const gaji = salaries[0]?.gajiPokok ?? 0;
    const calc = calcBpjsContribution(gaji, {
      kesEmployer: e.kesEmployer,
      kesEmployee: e.kesEmployee,
      tkEmployer: e.tkEmployer,
      tkEmployee: e.tkEmployee,
    });
    return { ...e, user, gajiPokok: gaji, calc };
  });

  return NextResponse.json({ enrollments: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, bpjsKes, bpjsTk } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId wajib" }, { status: 400 });

  const enrollment = await prisma.bpjsEnrollment.upsert({
    where: { userId },
    create: { userId, bpjsKes: bpjsKes?.trim() || null, bpjsTk: bpjsTk?.trim() || null },
    update: { bpjsKes: bpjsKes?.trim() || null, bpjsTk: bpjsTk?.trim() || null },
  });

  return NextResponse.json(enrollment, { status: 201 });
}
