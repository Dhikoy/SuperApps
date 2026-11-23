import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPeriodLabel, getPeriodRange } from "@/lib/period";
import { loadUserPayrollItem } from "@/lib/payroll-data";
import { toDateKey } from "@/lib/holidays";
import { getPeriodForDate } from "@/lib/period";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const defaultPeriod = getPeriodForDate();
  const year = parseInt(searchParams.get("year") ?? String(defaultPeriod.year), 10);
  const month = parseInt(searchParams.get("month") ?? String(defaultPeriod.month), 10);

  const { start, end } = getPeriodRange(year, month);
  const periodLabel = formatPeriodLabel(year, month);

  const holidays = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const holidayDates = new Set(holidays.map((h) => toDateKey(h.date)));

  const loaded = await loadUserPayrollItem(session.nik, year, month);
  if (!loaded) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  return NextResponse.json({
    year,
    month,
    periodLabel,
    holidayCount: holidayDates.size,
    item: loaded.item,
  });
}
