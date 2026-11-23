import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, gajiPokok } = await request.json();
  if (!userId || !gajiPokok || gajiPokok <= 0) {
    return NextResponse.json({ error: "userId dan gajiPokok wajib diisi" }, { status: 400 });
  }

  const salary = await prisma.userSalary.create({
    data: {
      userId,
      gajiPokok: Number(gajiPokok),
    },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "SET_SALARY",
    entity: "UserSalary",
    entityId: userId,
    details: `gaji pokok ${Number(gajiPokok).toLocaleString("id-ID")}`,
  });

  return NextResponse.json(salary, { status: 201 });
}
