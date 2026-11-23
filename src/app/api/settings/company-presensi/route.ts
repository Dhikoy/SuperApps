import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCompanyCode, getActiveCompanyCodes } from "@/lib/companies-server";
import { canManageHrSettings } from "@/lib/roles";
import {
  allowsShiftSelection,
  parseShiftOptionIds,
  resolveShiftChoices,
  serializeShiftOptionIds,
} from "@/lib/shift-options";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHrSettings(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [configs, offices, schedules, counts] = await Promise.all([
    prisma.companyPresensiConfig.findMany(),
    prisma.officeLocation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.workSchedule.findMany({ where: { isActive: true }, orderBy: { standardClockIn: "asc" } }),
    prisma.user.groupBy({
      by: ["company"],
      where: { role: { not: "SUPER_ADMIN" }, company: { not: null } },
      _count: { company: true },
    }),
  ]);

  const countMap = new Map(counts.map((c) => [c.company, c._count.company]));

  const companyCodes = await getActiveCompanyCodes();

  const companies = companyCodes.map((company) => {
    const cfg = configs.find((c) => c.company === company);
    const shiftOptionIds = parseShiftOptionIds(cfg?.shiftOptions);
    const availableShifts = resolveShiftChoices(
      shiftOptionIds,
      schedules,
      cfg?.workScheduleId ?? null
    );
    return {
      company,
      officeLocationId: cfg?.officeLocationId ?? null,
      workScheduleId: cfg?.workScheduleId ?? null,
      workDaysPerMonth: cfg?.workDaysPerMonth ?? 22,
      shiftOptionIds,
      allowShiftSelection: allowsShiftSelection(shiftOptionIds),
      availableShifts,
      officeLocation: cfg?.officeLocationId
        ? offices.find((o) => o.id === cfg.officeLocationId) ?? null
        : null,
      workSchedule: cfg?.workScheduleId
        ? schedules.find((s) => s.id === cfg.workScheduleId) ?? null
        : null,
      employeeCount: countMap.get(company) ?? 0,
    };
  });

  return NextResponse.json({ companies, offices, schedules });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHrSettings(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { company, officeLocationId, workScheduleId, workDaysPerMonth, shiftOptionIds } =
    await request.json();

  if (!company || !(await isValidCompanyCode(company))) {
    return NextResponse.json({ error: "PT tidak valid" }, { status: 400 });
  }

  if (officeLocationId) {
    const office = await prisma.officeLocation.findFirst({ where: { id: officeLocationId, isActive: true } });
    if (!office) return NextResponse.json({ error: "Lokasi kantor tidak valid" }, { status: 400 });
  }

  const parsedShiftIds = Array.isArray(shiftOptionIds)
    ? shiftOptionIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (parsedShiftIds.length > 0) {
    const validCount = await prisma.workSchedule.count({
      where: { id: { in: parsedShiftIds }, isActive: true },
    });
    if (validCount !== parsedShiftIds.length) {
      return NextResponse.json({ error: "Ada shift yang tidak valid" }, { status: 400 });
    }
  }

  const effectiveScheduleId =
    workScheduleId || (parsedShiftIds.length === 1 ? parsedShiftIds[0] : null);

  if (effectiveScheduleId) {
    const schedule = await prisma.workSchedule.findFirst({
      where: { id: effectiveScheduleId, isActive: true },
    });
    if (!schedule) return NextResponse.json({ error: "Shift tidak valid" }, { status: 400 });
  }

  const days = Math.min(31, Math.max(1, Number(workDaysPerMonth) || 22));
  const shiftOptions = serializeShiftOptionIds(parsedShiftIds);

  const saved = await prisma.companyPresensiConfig.upsert({
    where: { company },
    create: {
      company,
      officeLocationId: officeLocationId || null,
      workScheduleId: effectiveScheduleId || null,
      workDaysPerMonth: days,
      shiftOptions,
    },
    update: {
      officeLocationId: officeLocationId || null,
      workScheduleId: effectiveScheduleId || null,
      workDaysPerMonth: days,
      shiftOptions,
    },
    include: {
      officeLocation: { select: { id: true, name: true } },
      workSchedule: { select: { id: true, shiftName: true, standardClockIn: true } },
    },
  });

  const employeeCount = await prisma.user.count({
    where: { company, role: { not: "SUPER_ADMIN" } },
  });

  const allSchedules = await prisma.workSchedule.findMany({
    where: { isActive: true },
    orderBy: { standardClockIn: "asc" },
  });
  const savedShiftIds = parseShiftOptionIds(saved.shiftOptions);

  return NextResponse.json({
    company: saved.company,
    officeLocationId: saved.officeLocationId,
    workScheduleId: saved.workScheduleId,
    workDaysPerMonth: saved.workDaysPerMonth,
    shiftOptionIds: savedShiftIds,
    allowShiftSelection: allowsShiftSelection(savedShiftIds),
    availableShifts: resolveShiftChoices(savedShiftIds, allSchedules, saved.workScheduleId),
    officeLocation: saved.officeLocation,
    workSchedule: saved.workSchedule,
    employeeCount,
  });
}
