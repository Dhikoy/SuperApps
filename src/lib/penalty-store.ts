import type { SessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import {
  isFutureDateKey,
  isPeriodKey,
  jakartaDateKey,
  parseDateKey,
  parsePenaltyNote,
  parsePenaltyPoints,
  parsePenaltyRate,
  periodKey,
  previousPeriod,
  deductionAmount,
  type PenaltyPayrollState,
} from "@/lib/penalty";
import { getCalendarMonthRange } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { canManagePenalty, canUnlockPenalty } from "@/lib/roles";

type Fail = { error: string; status: number };

function fail(error: string, status: number): Fail {
  return { error, status };
}

async function actorProfile(session: SessionUser) {
  const user = await prisma.user.findUnique({
    where: { nik: session.nik },
    select: { company: true, name: true },
  });
  return {
    company: user?.company?.trim().toUpperCase() || null,
    name: user?.name ?? session.name,
  };
}

function crossCompany(role: SessionUser["role"]) {
  return role === "SUPER_ADMIN";
}

function companyDenied(role: SessionUser["role"], own: string | null, target: string | null) {
  if (crossCompany(role)) return null;
  if (!own) return "Akun belum punya perusahaan";
  if (!target || own !== target) return "Akses beda perusahaan";
  return null;
}

async function periodRow(company: string, period: string) {
  return prisma.penaltyPeriod.findUnique({
    where: { company_period: { company, period } },
  });
}

function lockedMessage() {
  return "Periode penalti sudah dikunci";
}

export async function listPenaltiesByDate(session: SessionUser, dateKey: string) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  const date = parseDateKey(dateKey);
  if (!date) return fail("Tanggal tidak valid", 400);

  const actor = await actorProfile(session);
  if (!crossCompany(session.role) && !actor.company) return fail("Akun belum punya perusahaan", 403);

  const entries = await prisma.employeePenalty.findMany({
    where: {
      date,
      deletedAt: null,
      ...(crossCompany(session.role) ? {} : { company: actor.company! }),
    },
    include: { creator: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const periods = await prisma.penaltyPeriod.findMany({
    where: {
      period: dateKey.slice(0, 7),
      status: "locked",
      ...(crossCompany(session.role) ? {} : { company: actor.company! }),
    },
    select: { company: true },
  });
  const lockedCompanies = periods.map((p) => p.company);

  return {
    date: dateKey,
    lockedCompanies,
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      company: e.company,
      points: e.points,
      note: e.note,
      createdByName: e.creator.name,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function createPenalty(
  session: SessionUser,
  body: { employeeId?: string; date?: string; points?: unknown; note?: unknown }
) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  const employeeId = String(body.employeeId ?? "").trim();
  const dateKey = String(body.date ?? "").trim();
  const date = parseDateKey(dateKey);
  if (!employeeId || !date) return fail("Karyawan dan tanggal wajib diisi", 400);
  if (isFutureDateKey(dateKey)) return fail("Tanggal penalti tidak boleh di masa depan", 400);

  const points = parsePenaltyPoints(body.points);
  if ("error" in points) return fail(points.error, 400);
  const note = parsePenaltyNote(body.note);
  if ("error" in note) return fail(note.error, 400);

  const employee = await prisma.user.findUnique({
    where: { nik: employeeId },
    select: { nik: true, name: true, company: true },
  });
  if (!employee) return fail("Karyawan tidak ditemukan", 404);
  const company = employee.company?.trim().toUpperCase() || null;
  if (!company) return fail("Karyawan belum punya perusahaan", 400);

  const actor = await actorProfile(session);
  const denied = companyDenied(session.role, actor.company, company);
  if (denied) return fail(denied, 403);

  const period = dateKey.slice(0, 7);
  const existing = await periodRow(company, period);
  if (existing?.status === "locked") return fail(lockedMessage(), 400);

  const created = await prisma.employeePenalty.create({
    data: {
      company,
      userId: employee.nik,
      date,
      points: points.points,
      note: note.note,
      createdByNik: session.nik,
    },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: actor.name,
    action: "create",
    entity: "EmployeePenalty",
    entityId: created.id,
    details: JSON.stringify({
      new: { company, employeeId: employee.nik, date: dateKey, points: points.points, note: note.note },
    }),
  });

  return { id: created.id, points: created.points, note: created.note };
}

export async function updatePenalty(
  session: SessionUser,
  id: string,
  body: { points?: unknown; note?: unknown }
) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  const points = parsePenaltyPoints(body.points);
  if ("error" in points) return fail(points.error, 400);
  const note = parsePenaltyNote(body.note);
  if ("error" in note) return fail(note.error, 400);

  const current = await prisma.employeePenalty.findFirst({
    where: { id, deletedAt: null },
  });
  if (!current) return fail("Penalti tidak ditemukan", 404);

  const actor = await actorProfile(session);
  const denied = companyDenied(session.role, actor.company, current.company);
  if (denied) return fail(denied, 403);

  const dateKey = jakartaDateKey(current.date);
  const existing = await periodRow(current.company, dateKey.slice(0, 7));
  if (existing?.status === "locked") return fail(lockedMessage(), 400);

  const updated = await prisma.employeePenalty.update({
    where: { id },
    data: {
      points: points.points,
      note: note.note,
      updatedByNik: session.nik,
    },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: actor.name,
    action: "update",
    entity: "EmployeePenalty",
    entityId: id,
    details: JSON.stringify({
      old: { points: current.points, note: current.note },
      new: { points: points.points, note: note.note },
    }),
  });

  return { id: updated.id, points: updated.points, note: updated.note };
}

export async function deletePenalty(session: SessionUser, id: string) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  const current = await prisma.employeePenalty.findFirst({
    where: { id, deletedAt: null },
  });
  if (!current) return fail("Penalti tidak ditemukan", 404);

  const actor = await actorProfile(session);
  const denied = companyDenied(session.role, actor.company, current.company);
  if (denied) return fail(denied, 403);

  const dateKey = jakartaDateKey(current.date);
  const existing = await periodRow(current.company, dateKey.slice(0, 7));
  if (existing?.status === "locked") return fail(lockedMessage(), 400);

  await prisma.employeePenalty.update({
    where: { id },
    data: { deletedAt: new Date(), updatedByNik: session.nik },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: actor.name,
    action: "delete",
    entity: "EmployeePenalty",
    entityId: id,
    details: JSON.stringify({
      old: {
        company: current.company,
        employeeId: current.userId,
        date: dateKey,
        points: current.points,
        note: current.note,
      },
    }),
  });

  return { ok: true };
}

function emptySummary(input: {
  company: string | null;
  canSwitchCompany: boolean;
  canUnlock: boolean;
  period: string;
  needsCompany?: boolean;
}) {
  return {
    needsCompany: Boolean(input.needsCompany),
    company: input.company,
    canSwitchCompany: input.canSwitchCompany,
    canUnlock: input.canUnlock,
    period: input.period,
    status: "open" as const,
    ratePerPoint: null as number | null,
    previousRate: null as number | null,
    rows: [] as SummaryRow[],
  };
}

type SummaryRow = {
  nik: string;
  name: string;
  department: string | null;
  incidents: number;
  totalPoints: number;
  ratePerPoint: number | null;
  deduction: number | null;
};

export async function penaltySummary(session: SessionUser, period: string, requestedCompany?: string | null) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  if (!isPeriodKey(period)) return fail("Periode harus YYYY-MM", 400);

  const actor = await actorProfile(session);
  const canSwitchCompany = crossCompany(session.role);
  const requested = requestedCompany?.trim().toUpperCase() || null;
  if (!canSwitchCompany && !actor.company) return fail("Akun belum punya perusahaan", 403);
  const denied = companyDenied(session.role, actor.company, requested ?? actor.company);
  if (denied) return fail(denied, 403);

  const company = canSwitchCompany ? requested : actor.company;
  if (!company) {
    return emptySummary({
      company: null,
      canSwitchCompany,
      canUnlock: canUnlockPenalty(session.role),
      period,
      needsCompany: true,
    });
  }

  const [year, month] = period.split("-").map(Number);
  const { start, end } = getCalendarMonthRange(year, month);
  const [users, entries, current, previous] = await Promise.all([
    prisma.user.findMany({
      where: { company },
      select: { nik: true, name: true, department: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.employeePenalty.findMany({
      where: { company, deletedAt: null, date: { gte: start, lte: end } },
      select: { userId: true, points: true },
    }),
    periodRow(company, period),
    periodRow(company, previousPeriod(period) ?? ""),
  ]);

  const byUser = new Map<string, { incidents: number; points: number }>();
  for (const entry of entries) {
    const prev = byUser.get(entry.userId) ?? { incidents: 0, points: 0 };
    prev.incidents += 1;
    prev.points += entry.points;
    byUser.set(entry.userId, prev);
  }

  const rate = current?.ratePerPoint ?? null;
  const rows = users
    .map((user) => {
      const agg = byUser.get(user.nik) ?? { incidents: 0, points: 0 };
      return {
        nik: user.nik,
        name: user.name,
        department: user.department?.name ?? null,
        incidents: agg.incidents,
        totalPoints: agg.points,
        ratePerPoint: rate,
        deduction: rate == null ? null : deductionAmount(agg.points, rate),
      };
    })
    .filter((row) => row.incidents > 0);

  return {
    needsCompany: false,
    company,
    canSwitchCompany,
    canUnlock: canUnlockPenalty(session.role),
    period,
    status: current?.status === "locked" ? "locked" : "open",
    ratePerPoint: rate,
    previousRate: previous?.ratePerPoint ?? null,
    rows,
  };
}

export async function penaltyEmployeeDetail(session: SessionUser, nik: string, period: string) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  if (!isPeriodKey(period)) return fail("Periode harus YYYY-MM", 400);

  const employee = await prisma.user.findUnique({
    where: { nik },
    select: { nik: true, name: true, company: true, department: { select: { name: true } } },
  });
  if (!employee) return fail("Karyawan tidak ditemukan", 404);
  const company = employee.company?.trim().toUpperCase() || null;
  if (!company) return fail("Karyawan belum punya perusahaan", 400);

  const actor = await actorProfile(session);
  const denied = companyDenied(session.role, actor.company, company);
  if (denied) return fail(denied, 403);

  const [year, month] = period.split("-").map(Number);
  const { start, end } = getCalendarMonthRange(year, month);
  const [entries, current] = await Promise.all([
    prisma.employeePenalty.findMany({
      where: { userId: nik, company, deletedAt: null, date: { gte: start, lte: end } },
      include: { creator: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    periodRow(company, period),
  ]);

  const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
  const rate = current?.ratePerPoint ?? null;

  return {
    employee: {
      nik: employee.nik,
      name: employee.name,
      company,
      department: employee.department?.name ?? null,
    },
    period,
    status: current?.status === "locked" ? "locked" : "open",
    ratePerPoint: rate,
    totalPoints,
    incidents: entries.length,
    deduction: rate == null ? null : deductionAmount(totalPoints, rate),
    entries: entries.map((entry) => ({
      id: entry.id,
      date: jakartaDateKey(entry.date),
      points: entry.points,
      note: entry.note,
      createdByName: entry.creator.name,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function setPenaltyRate(
  session: SessionUser,
  period: string,
  body: { company?: string; ratePerPoint?: unknown; usePrevious?: boolean }
) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  if (!isPeriodKey(period)) return fail("Periode harus YYYY-MM", 400);

  const actor = await actorProfile(session);
  const requested = String(body.company ?? actor.company ?? "").trim().toUpperCase();
  if (!requested) return fail("Pilih perusahaan", 400);
  const denied = companyDenied(session.role, actor.company, requested);
  if (denied) return fail(denied, 403);

  const current = await periodRow(requested, period);
  if (current?.status === "locked") return fail(lockedMessage(), 400);

  let rate: number;
  if (body.usePrevious) {
    const prev = await periodRow(requested, previousPeriod(period) ?? "");
    if (prev?.ratePerPoint == null) return fail("Rate bulan lalu belum ditentukan", 400);
    rate = prev.ratePerPoint;
  } else {
    const parsed = parsePenaltyRate(body.ratePerPoint);
    if ("error" in parsed) return fail(parsed.error, 400);
    rate = parsed.rate;
  }

  const saved = await prisma.penaltyPeriod.upsert({
    where: { company_period: { company: requested, period } },
    create: {
      company: requested,
      period,
      ratePerPoint: rate,
      status: "open",
      rateSetBy: session.nik,
      rateSetAt: new Date(),
    },
    update: {
      ratePerPoint: rate,
      rateSetBy: session.nik,
      rateSetAt: new Date(),
    },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: actor.name,
    action: "set_rate",
    entity: "PenaltyPeriod",
    entityId: saved.id,
    details: JSON.stringify({
      old: { ratePerPoint: current?.ratePerPoint ?? null },
      new: { company: requested, period, ratePerPoint: rate },
    }),
  });

  return { company: requested, period, ratePerPoint: rate, status: saved.status };
}

export async function lockPenaltyPeriod(session: SessionUser, period: string, companyRaw?: string) {
  if (!canManagePenalty(session.role)) return fail("Forbidden", 403);
  if (!isPeriodKey(period)) return fail("Periode harus YYYY-MM", 400);

  const actor = await actorProfile(session);
  const company = String(companyRaw ?? actor.company ?? "").trim().toUpperCase();
  if (!company) return fail("Pilih perusahaan", 400);
  const denied = companyDenied(session.role, actor.company, company);
  if (denied) return fail(denied, 403);

  const current = await periodRow(company, period);
  if (current?.ratePerPoint == null) {
    return fail("Kunci periode hanya aktif jika rate sudah diisi", 400);
  }
  if (current.status === "locked") return fail("Periode sudah dikunci", 400);

  const saved = await prisma.penaltyPeriod.update({
    where: { id: current.id },
    data: { status: "locked", lockedBy: session.nik, lockedAt: new Date() },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: actor.name,
    action: "lock",
    entity: "PenaltyPeriod",
    entityId: saved.id,
    details: JSON.stringify({
      old: { status: "open" },
      new: { company, period, status: "locked", ratePerPoint: current.ratePerPoint },
    }),
  });

  return { company, period, status: "locked" as const };
}

export async function unlockPenaltyPeriod(
  session: SessionUser,
  period: string,
  body: { company?: string; reason?: string }
) {
  if (!canUnlockPenalty(session.role)) return fail("Hanya Super Admin yang bisa membuka kunci", 403);
  if (!isPeriodKey(period)) return fail("Periode harus YYYY-MM", 400);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return fail("Alasan buka kunci wajib diisi", 400);

  const actor = await actorProfile(session);
  const company = String(body.company ?? actor.company ?? "").trim().toUpperCase();
  if (!company) return fail("Pilih perusahaan", 400);
  const denied = companyDenied(session.role, actor.company, company);
  if (denied) return fail(denied, 403);

  const current = await periodRow(company, period);
  if (!current || current.status !== "locked") return fail("Periode belum dikunci", 400);

  const saved = await prisma.penaltyPeriod.update({
    where: { id: current.id },
    data: { status: "open", lockedBy: null, lockedAt: null },
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: actor.name,
    action: "unlock",
    entity: "PenaltyPeriod",
    entityId: saved.id,
    details: JSON.stringify({
      old: { status: "locked" },
      new: { company, period, status: "open" },
      reason,
    }),
  });

  return { company, period, status: "open" as const };
}

export async function penaltyExportRows(session: SessionUser, period: string, requestedCompany?: string | null) {
  const summary = await penaltySummary(session, period, requestedCompany);
  if ("error" in summary) return summary;
  if (!summary.company) return fail("Pilih perusahaan", 400);

  const [year, month] = period.split("-").map(Number);
  const { start, end } = getCalendarMonthRange(year, month);
  const details = await prisma.employeePenalty.findMany({
    where: { company: summary.company, deletedAt: null, date: { gte: start, lte: end } },
    include: {
      user: { select: { name: true, department: { select: { name: true } } } },
      creator: { select: { name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { date: "asc" }, { createdAt: "asc" }],
  });

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "export",
    entity: "PenaltyPeriod",
    details: JSON.stringify({ company: summary.company, period }),
  });

  return { summary, details };
}

export async function loadPenaltyPayrollMap(year: number, month: number) {
  const period = periodKey(year, month);
  const { start, end } = getCalendarMonthRange(year, month);
  const [entries, periods] = await Promise.all([
    prisma.employeePenalty.groupBy({
      by: ["userId", "company"],
      where: { deletedAt: null, date: { gte: start, lte: end } },
      _sum: { points: true },
    }),
    prisma.penaltyPeriod.findMany({ where: { period } }),
  ]);

  const periodByCompany = new Map(periods.map((row) => [row.company, row]));
  const grouped = new Map<string, { company: string; points: number }[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.userId) ?? [];
    list.push({ company: entry.company, points: entry._sum.points ?? 0 });
    grouped.set(entry.userId, list);
  }

  const map = new Map<string, PenaltyPayrollState>();
  for (const [userId, list] of grouped) {
    const points = list.reduce((sum, row) => sum + row.points, 0);
    const states = list.map((row) => periodByCompany.get(row.company));
    const locked = states.every((row) => row?.status === "locked");
    const rates = states.map((row) => row?.ratePerPoint ?? null);
    const rate = rates.every((value) => value === rates[0]) ? rates[0] : null;
    map.set(userId, { points, ratePerPoint: locked ? rate : rates[0] ?? null, locked });
  }
  return map;
}
