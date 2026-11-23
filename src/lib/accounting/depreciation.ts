import { prisma } from "@/lib/prisma";
import { DEPRECIATION_MAP } from "./constants";
import {
  accumulatedDepreciation,
  depreciationForMonth,
  depreciationSourceId,
  JournalError,
  syncDepreciationJournal,
} from "./journal";

export async function depreciationCompanies(company: string | null) {
  if (company) return [company];
  const rows = await prisma.asset.findMany({
    where: { company: { not: null }, acquisitionCost: { gt: 0 }, usefulLifeMonths: { gt: 0 } },
    select: { company: true },
    distinct: ["company"],
  });
  return rows.map((r) => r.company!).filter(Boolean);
}

/** Buat/perbarui jurnal penyusutan bulan tsb untuk satu atau semua perusahaan. */
export async function postDepreciation(year: number, month: number, company: string | null, actor: string) {
  const results: { company: string; total: number; assetCount: number; error?: string }[] = [];
  for (const c of await depreciationCompanies(company)) {
    try {
      const r = await prisma.$transaction((tx) => syncDepreciationJournal(tx, c, year, month, actor));
      results.push({ company: c, ...r });
    } catch (error) {
      if (!(error instanceof JournalError)) throw error;
      results.push({ company: c, total: 0, assetCount: 0, error: error.message });
    }
  }
  return results;
}

export async function depreciationSchedule(year: number, month: number, company: string | null) {
  const assets = await prisma.asset.findMany({
    where: company ? { OR: [{ company }, { company: null }] } : {},
    orderBy: [{ acquisitionDate: "desc" }, { laptop: "asc" }],
    select: {
      id: true,
      laptop: true,
      serialNumber: true,
      category: true,
      quantity: true,
      company: true,
      acquisitionCost: true,
      acquisitionDate: true,
      usefulLifeMonths: true,
      residualValue: true,
      assetAccount: true,
    },
  });

  const rows = assets.map((a) => {
    const configured = Boolean(a.company && a.acquisitionCost && a.acquisitionDate && a.usefulLifeMonths && a.assetAccount);
    const monthly = configured ? depreciationForMonth(a, year, month) : 0;
    const accumulated = configured ? accumulatedDepreciation(a, year, month) : 0;
    return {
      ...a,
      acquisitionDate: a.acquisitionDate?.toISOString() ?? null,
      configured,
      depreciable: Boolean(a.assetAccount && DEPRECIATION_MAP[a.assetAccount]),
      monthly,
      accumulated,
      bookValue: configured ? Math.round(((a.acquisitionCost ?? 0) - accumulated) * 100) / 100 : null,
    };
  });

  const companies = company ? [company] : [...new Set(rows.filter((r) => r.configured).map((r) => r.company!))];
  const journals = await prisma.journalEntry.findMany({
    where: { source: "DEPRECIATION", sourceId: { in: companies.map((c) => depreciationSourceId(c, year, month)) } },
    select: { id: true, number: true, company: true, lines: { select: { debit: true } } },
  });

  return {
    year,
    month,
    rows,
    totalMonthly: Math.round(rows.reduce((s, r) => s + r.monthly, 0) * 100) / 100,
    posted: journals.map((j) => ({
      id: j.id,
      number: j.number,
      company: j.company,
      total: Math.round(j.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100,
    })),
  };
}
