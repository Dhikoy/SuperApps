import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANIES } from "@/lib/companies";

export async function getActiveCompanyCodes(): Promise<string[]> {
  try {
    const rows = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { code: true },
    });
    if (rows.length === 0) return [...DEFAULT_COMPANIES];
    return rows.map((r) => r.code);
  } catch {
    return [...DEFAULT_COMPANIES];
  }
}

export async function isValidCompanyCode(code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  try {
    const found = await prisma.company.findFirst({
      where: { code: normalized, isActive: true },
    });
    return !!found;
  } catch {
    return DEFAULT_COMPANIES.includes(normalized as (typeof DEFAULT_COMPANIES)[number]);
  }
}

export async function getCompaniesWithStats() {
  const companies = await prisma.company.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  const counts = await prisma.user.groupBy({
    by: ["company"],
    _count: { nik: true },
    where: { role: { not: "SUPER_ADMIN" } },
  });

  const countMap = new Map(counts.map((c) => [c.company ?? "", c._count.nik]));

  return companies.map((c) => ({
    ...c,
    employeeCount: countMap.get(c.code) ?? 0,
  }));
}
