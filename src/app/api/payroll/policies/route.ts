import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAYROLL_POLICIES } from "@/lib/payroll-policy";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const policies = await prisma.payrollPolicy.findMany({ orderBy: { company: "asc" } });
  if (policies.length === 0) {
    return NextResponse.json(DEFAULT_PAYROLL_POLICIES);
  }
  return NextResponse.json(policies);
}
