import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { resolveOvertimeType } from "@/lib/payroll";
import { loadPolicyResolver } from "@/lib/payroll-data";
import { toDateKey } from "@/lib/holidays";
import type { OvertimeType } from "@/generated/prisma/client";

const overtimeInclude = { user: { select: { name: true, userId: true, company: true } } } as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:view") && !hasPermission(session.role, "overtime:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const canManage = hasPermission(session.role, "payroll:manage");
  const allUsers = canManage && searchParams.get("scope") === "all" && !userId;
  const targetUserId = canManage && userId ? userId : session.id;

  const overtimes = await prisma.overtime.findMany({
    where: allUsers ? {} : { userId: targetUserId },
    include: overtimeInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: allUsers ? 300 : 50,
  });

  return NextResponse.json(overtimes);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "overtime:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { date, hours, type, remarks, userId, userIds, startTime, endTime, description } = await request.json();

  if (!date || !hours || Number(hours) <= 0) {
    return NextResponse.json({ error: "Tanggal dan jam lembur wajib diisi" }, { status: 400 });
  }

  const canManage = hasPermission(session.role, "payroll:manage");
  const bulk = canManage && Array.isArray(userIds);
  const targetIds: string[] = bulk
    ? [...new Set((userIds as unknown[]).filter((id): id is string => typeof id === "string" && !!id))]
    : [canManage && userId ? userId : session.id];
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu karyawan" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { nik: { in: targetIds } },
    select: { nik: true, name: true, company: true },
  });
  const resolvePolicy = await loadPolicyResolver();
  const eligible = users.filter((u) => resolvePolicy(u.company)?.overtimeWeekday);
  const skipped = [
    ...targetIds.filter((id) => !users.some((u) => u.nik === id)).map((id) => ({ nik: id, name: id, reason: "Karyawan tidak ditemukan" })),
    ...users
      .filter((u) => !eligible.includes(u))
      .map((u) => ({ nik: u.nik, name: u.name, reason: `Lembur tidak berlaku untuk PT ${u.company ?? "-"}` })),
  ];

  if (!bulk && eligible.length === 0) {
    const reason = skipped[0]?.reason ?? "Karyawan tidak ditemukan";
    return NextResponse.json(
      { error: reason.startsWith("Lembur") ? "Lembur hanya berlaku untuk perusahaan mode hourly (BCI, PIC, MKTECH, MNT, DPI)" : reason },
      { status: reason.startsWith("Lembur") ? 400 : 404 }
    );
  }
  if (eligible.length === 0) {
    return NextResponse.json({ error: "Tidak ada karyawan yang berhak lembur", skipped }, { status: 400 });
  }

  const overtimeDate = new Date(date);
  overtimeDate.setHours(0, 0, 0, 0);

  const holidays = await prisma.publicHoliday.findMany();
  const holidayDates = new Set(holidays.map((h) => toDateKey(h.date)));
  const resolvedType = resolveOvertimeType(overtimeDate, holidayDates, (type || undefined) as OvertimeType | undefined);

  // Lembur yang diinput HR/keuangan untuk karyawan dianggap sudah disetujui.
  const autoApprove = bulk;
  const created = await prisma.$transaction(
    eligible.map((u) =>
      prisma.overtime.create({
        data: {
          userId: u.nik,
          date: overtimeDate,
          hours: Number(hours),
          type: resolvedType,
          startTime: startTime || null,
          endTime: endTime || null,
          description: description || null,
          remarks: remarks || null,
          ...(autoApprove
            ? { approvalStatus: "APPROVED" as const, approvedBy: session.nik, approvedAt: new Date() }
            : {}),
        },
        include: overtimeInclude,
      })
    )
  );

  void import("@/lib/telegram/notify").then(async ({ notifyOvertimeSubmitted, notifyOvertimeDecided }) => {
    for (const overtime of created) {
      if (autoApprove) {
        await notifyOvertimeDecided({
          userId: overtime.userId,
          approved: true,
          hours: overtime.hours,
          date: overtime.date,
        });
      } else {
        await notifyOvertimeSubmitted(overtime);
      }
    }
  });

  if (!bulk) return NextResponse.json(created[0], { status: 201 });
  return NextResponse.json({ created: created.length, skipped, items: created }, { status: 201 });
}
