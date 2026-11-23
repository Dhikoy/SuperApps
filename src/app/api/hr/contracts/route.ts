import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const contracts = await prisma.employmentContract.findMany({
    include: { user: { select: { name: true, company: true, nik: true } } },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ contracts });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, type, startDate, endDate, notes } = await request.json();
  if (!userId || !type || !startDate) {
    return NextResponse.json({ error: "userId, type, dan startDate wajib" }, { status: 400 });
  }

  const contract = await prisma.employmentContract.create({
    data: {
      userId,
      type,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(contract, { status: 201 });
}
