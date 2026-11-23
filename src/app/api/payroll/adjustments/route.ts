import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { formatPeriodLabel } from "@/lib/period";
import { writeAuditLog } from "@/lib/audit-log";

function parsePeriod(year: unknown, month: unknown) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("year"), request.nextUrl.searchParams.get("month"));
  if (!period) return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });

  const rows = await prisma.payrollAdjustment.findMany({ where: period });
  return NextResponse.json(rows);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const period = parsePeriod(body.year, body.month);
  if (!period) return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  const userId = typeof body.userId === "string" ? body.userId : "";
  const allowance = parseAmount(body.allowance);
  const mealAllowance = parseAmount(body.mealAllowance);
  const deduction = parseAmount(body.deduction);
  if (allowance === null || mealAllowance === null || deduction === null) {
    return NextResponse.json({ error: "Nominal harus angka ≥ 0" }, { status: 400 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;

  const user = await prisma.user.findUnique({ where: { nik: userId }, select: { nik: true, name: true } });
  if (!user) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

  const where = { userId_year_month: { userId, ...period } };
  let row = null;
  if (!allowance && !mealAllowance && !deduction && !note) {
    await prisma.payrollAdjustment.deleteMany({ where: { userId, ...period } });
  } else {
    const data = { allowance, mealAllowance, deduction, note, updatedBy: session.nik };
    row = await prisma.payrollAdjustment.upsert({
      where,
      create: { userId, ...period, ...data },
      update: data,
    });
  }

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "UPDATE_PAYROLL_ADJUSTMENT",
    entity: "PayrollAdjustment",
    entityId: userId,
    details: `${user.name} · ${formatPeriodLabel(period.year, period.month)} · tunjangan ${allowance}, uang makan ${mealAllowance}, potongan ${deduction}`,
  });

  return NextResponse.json({ ok: true, adjustment: row });
}
