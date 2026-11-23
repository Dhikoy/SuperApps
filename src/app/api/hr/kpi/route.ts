import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const reviews = await prisma.performanceReview.findMany({
    include: { user: { select: { name: true, company: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reviews });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, period, score, kpiNotes } = await request.json();
  if (!userId || !period?.trim() || score === undefined) {
    return NextResponse.json({ error: "userId, period, dan score wajib" }, { status: 400 });
  }

  const review = await prisma.performanceReview.create({
    data: {
      userId,
      period: period.trim(),
      score: Number(score),
      kpiNotes: kpiNotes?.trim() || null,
      reviewerNik: auth.session!.nik,
    },
  });

  return NextResponse.json(review, { status: 201 });
}
