import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";
import { calcPph21Monthly } from "@/lib/pph21";
import { hasPermission } from "@/lib/roles";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const profiles = await prisma.pph21Profile.findMany({
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
  const rows = profiles.map(({ user: { salaries, ...user }, ...p }) => {
    if (!canSeeSalary) return { ...p, user, gajiPokok: null, calc: null };
    const gaji = salaries[0]?.gajiPokok ?? 0;
    return { ...p, user, gajiPokok: gaji, calc: calcPph21Monthly(gaji, p.ptkpStatus) };
  });

  return NextResponse.json({ profiles: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, npwp, ptkpStatus, dependents } = await request.json();
  if (!userId) return NextResponse.json({ error: "userId wajib" }, { status: 400 });

  const profile = await prisma.pph21Profile.upsert({
    where: { userId },
    create: {
      userId,
      npwp: npwp?.trim() || null,
      ptkpStatus: ptkpStatus || "TK/0",
      dependents: Number(dependents) || 0,
    },
    update: {
      npwp: npwp?.trim() || null,
      ptkpStatus: ptkpStatus || "TK/0",
      dependents: Number(dependents) || 0,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}
