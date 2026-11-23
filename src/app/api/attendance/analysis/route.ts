import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getAttendanceAnalysis } from "@/lib/attendance-analysis-server";
import { prisma } from "@/lib/prisma";
import { hasAnyPermission } from "@/lib/roles";
import { getCalendarMonthForDate } from "@/lib/period";

const reviewSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  userId: z.string().min(1),
  confirmedCause: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  followUp: z.string().trim().max(2000).nullable().optional(),
  status: z
    .enum(["BELUM_DIKONFIRMASI", "DIPANTAU", "SELESAI"])
    .default("BELUM_DIKONFIRMASI"),
});

function canManage(role: Parameters<typeof hasAnyPermission>[0]) {
  return hasAnyPermission(role, ["attendance:manage", "hr:manage"]);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = getCalendarMonthForDate();
  const year = Number(request.nextUrl.searchParams.get("year") ?? current.year);
  const month = Number(request.nextUrl.searchParams.get("month") ?? current.month);
  const company = request.nextUrl.searchParams.get("company") || undefined;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  }

  return NextResponse.json(await getAttendanceAnalysis({ year, month, company }));
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data review tidak valid", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const employee = await prisma.user.findUnique({
    where: { nik: parsed.data.userId },
    select: { nik: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  const clean = (value: string | null | undefined) => value || null;
  const review = await prisma.attendanceIssueReview.upsert({
    where: {
      period_userId: {
        period: parsed.data.period,
        userId: parsed.data.userId,
      },
    },
    create: {
      period: parsed.data.period,
      userId: parsed.data.userId,
      confirmedCause: clean(parsed.data.confirmedCause),
      notes: clean(parsed.data.notes),
      followUp: clean(parsed.data.followUp),
      status: parsed.data.status,
      reviewerNik: session.nik,
      reviewedAt: new Date(),
    },
    update: {
      confirmedCause: clean(parsed.data.confirmedCause),
      notes: clean(parsed.data.notes),
      followUp: clean(parsed.data.followUp),
      status: parsed.data.status,
      reviewerNik: session.nik,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json(review);
}
