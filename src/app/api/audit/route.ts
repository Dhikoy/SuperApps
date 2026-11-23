import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "settings:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10);

  const logs = await prisma.auditLog.findMany({
    where: hasPermission(session.role, "payroll:view")
      ? undefined
      : { action: { notIn: ["SET_SALARY", "UPDATE_PAYROLL_ADJUSTMENT"] } },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });

  return NextResponse.json({ logs });
}
