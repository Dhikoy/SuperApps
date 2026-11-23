import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANIES } from "@/lib/companies";
import { getCompaniesWithStats } from "@/lib/companies-server";
import { canManageCompanies, hasPermission } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const all = request.nextUrl.searchParams.get("all") === "1";

  if (!session) {
    try {
      const active = await prisma.company.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        select: { code: true, name: true },
      });
      if (active.length > 0) return NextResponse.json(active);
    } catch {
      /* fallback */
    }
    return NextResponse.json(DEFAULT_COMPANIES.map((code) => ({ code, name: code })));
  }

  const canManage = canManageCompanies(session.role);

  if (!canManage && !hasPermission(session.role, "users:view")) {
    const active = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { code: true, name: true },
    });
    return NextResponse.json(active);
  }

  const companies = await getCompaniesWithStats();
  if (!all) {
    return NextResponse.json(companies.filter((c) => c.isActive));
  }
  return NextResponse.json(companies);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageCompanies(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const code = String(body.code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const name = String(body.name ?? "").trim();
  const description = body.description?.trim() || null;

  if (!code || code.length < 2 || code.length > 10) {
    return NextResponse.json({ error: "Kode PT wajib 2–10 karakter (huruf/angka)" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Nama PT wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.company.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: `PT ${code} sudah ada` }, { status: 400 });
  }

  const maxOrder = await prisma.company.aggregate({ _max: { sortOrder: true } });

  const company = await prisma.company.create({
    data: {
      code,
      name,
      description,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  await prisma.companyPresensiConfig.upsert({
    where: { company: code },
    create: { company: code, workDaysPerMonth: 22 },
    update: {},
  });

  return NextResponse.json({ ...company, employeeCount: 0 }, { status: 201 });
}
