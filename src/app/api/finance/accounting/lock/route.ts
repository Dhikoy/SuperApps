import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { getPeriodRange } from "@/lib/period";
import { depreciationCompanies } from "@/lib/accounting/depreciation";
import { depreciationSourceId, LOCK_DATE_KEY } from "@/lib/accounting/journal";
import { endOfDayJakarta, startOfDayJakarta, todayJakarta } from "@/lib/accounting/reports";

function lastDayOfMonth(year: number, month: number) {
  const d = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Pemeriksaan sebelum tutup buku satu bulan. */
async function checklist(year: number, month: number) {
  const from = startOfDayJakarta(`${year}-${String(month).padStart(2, "0")}-01`);
  const to = endOfDayJakarta(lastDayOfMonth(year, month));

  const [sums, pendingRealization, draftInvoices, payroll, companies] = await Promise.all([
    prisma.journalLine.aggregate({ where: { date: { lte: to } }, _sum: { debit: true, credit: true } }),
    prisma.fundRequest.count({ where: { status: "PAID", paidAt: { lte: to } } }),
    prisma.invoice.count({ where: { docType: "INVOICE", status: "DRAFT", issueDate: { gte: from, lte: to } } }),
    prisma.payrollPosting.count({ where: { year, month } }),
    depreciationCompanies(null),
  ]);
  const posted = companies.length
    ? await prisma.journalEntry.count({
        where: { source: "DEPRECIATION", sourceId: { in: companies.map((c) => depreciationSourceId(c, year, month)) } },
      })
    : 0;

  const debit = sums._sum.debit ?? 0;
  const credit = sums._sum.credit ?? 0;
  const payrollPeriod = getPeriodRange(year, month);
  return [
    {
      key: "balanced",
      label: "Total debit = kredit s/d akhir bulan",
      ok: Math.abs(debit - credit) < 0.01,
      detail: Math.abs(debit - credit) < 0.01 ? "Seimbang" : `Selisih ${(debit - credit).toLocaleString("id-ID")}`,
    },
    {
      key: "depreciation",
      label: "Penyusutan aset bulan ini sudah diposting",
      ok: companies.length === 0 || posted >= companies.length,
      detail: companies.length === 0 ? "Belum ada aset dengan data penyusutan" : `${posted}/${companies.length} perusahaan`,
    },
    {
      key: "payroll",
      label: "Payroll periode ini sudah diposting",
      ok: payroll > 0,
      detail: payroll > 0 ? `${payroll} posting` : `Periode ${payrollPeriod.start.toLocaleDateString("id-ID")}–${payrollPeriod.end.toLocaleDateString("id-ID")} belum diposting`,
    },
    {
      key: "realization",
      label: "Pengajuan dana yang sudah dibayar sudah direalisasi",
      ok: pendingRealization === 0,
      detail: pendingRealization === 0 ? "Tidak ada" : `${pendingRealization} pengajuan masih di uang muka karyawan (122)`,
    },
    {
      key: "draft-invoice",
      label: "Tidak ada invoice draft di bulan ini",
      ok: draftInvoices === 0,
      detail: draftInvoices === 0 ? "Tidak ada" : `${draftInvoices} invoice draft belum diterbitkan (belum jadi piutang)`,
    },
  ];
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const setting = await prisma.accountingSetting.findUnique({ where: { key: LOCK_DATE_KEY } });
  const params = request.nextUrl.searchParams;
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));
  const checks = year >= 2000 && month >= 1 && month <= 12 ? await checklist(year, month) : [];

  return NextResponse.json({
    lockDate: setting?.value || null,
    updatedBy: setting?.updatedBy ?? null,
    updatedAt: setting?.updatedAt ?? null,
    checks,
  });
}

/** POST { lockDate: "YYYY-MM-DD" | null } — mundur / buka kembali hanya Super Admin & Admin. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const next = typeof body.lockDate === "string" && body.lockDate ? body.lockDate : null;
  if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) {
    return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  }
  if (next && next > todayJakarta()) {
    return NextResponse.json({ error: "Tidak bisa tutup buku untuk tanggal yang belum lewat" }, { status: 400 });
  }

  const current = (await prisma.accountingSetting.findUnique({ where: { key: LOCK_DATE_KEY } }))?.value || null;
  const reopening = current && (!next || next < current);
  if (reopening && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Membuka kembali periode yang sudah ditutup hanya bisa oleh Super Admin / Admin" }, { status: 403 });
  }

  if (next) {
    await prisma.accountingSetting.upsert({
      where: { key: LOCK_DATE_KEY },
      create: { key: LOCK_DATE_KEY, value: next, updatedBy: session.nik },
      update: { value: next, updatedBy: session.nik },
    });
  } else {
    await prisma.accountingSetting.deleteMany({ where: { key: LOCK_DATE_KEY } });
  }
  return NextResponse.json({ ok: true, lockDate: next });
}
