import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { formatPeriodLabel, getPeriodRange, getPeriodForDate } from "@/lib/period";
import { buildPayrollLineItem } from "@/lib/payroll";
import { formatRupiah } from "@/lib/payroll-policy";
import { loadPayrollAdjustmentMap, loadPolicyResolver } from "@/lib/payroll-data";
import { writeAuditLog } from "@/lib/audit-log";
import { loadPenaltyPayrollMap } from "@/lib/penalty-store";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const defaultPeriod = getPeriodForDate();
  const year = parseInt(searchParams.get("year") ?? String(defaultPeriod.year), 10);
  const month = parseInt(searchParams.get("month") ?? String(defaultPeriod.month), 10);
  const company = searchParams.get("company")?.toUpperCase() ?? undefined;

  const { start, end } = getPeriodRange(year, month);
  const periodLabel = formatPeriodLabel(year, month);

  const resolvePolicy = await loadPolicyResolver();
  const adjustmentMap = await loadPayrollAdjustmentMap(year, month);

  const penaltyMap = await loadPenaltyPayrollMap(year, month);

  const users = await prisma.user.findMany({
    where: {
      role: { not: "SUPER_ADMIN" },
      ...(company ? { company } : {}),
    },
    select: {
      nik: true,
      name: true,
      userId: true,
      company: true,
      attendances: {
        where: { date: { gte: start, lte: end } },
        select: { status: true },
      },
      overtimes: {
        where: { date: { gte: start, lte: end }, approvalStatus: "APPROVED" },
        select: { hours: true, type: true },
      },
      salaries: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { gajiPokok: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const items = users.map((u) => {
    return buildPayrollLineItem({
      nik: u.nik,
      name: u.name,
      userId: u.userId,
      company: u.company,
      gajiPokok: u.salaries[0]?.gajiPokok ?? 0,
      attendances: u.attendances,
      overtimes: u.overtimes,
      policyOverride: resolvePolicy(u.company),
      penalty: penaltyMap.get(u.nik) ?? null,
      adjustment: adjustmentMap.get(u.nik) ?? null,
    });
  });

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("SuperApps BCI — Laporan Payroll", 14, 16);
  doc.setFontSize(10);
  doc.text(periodLabel, 14, 24);

  autoTable(doc, {
    startY: 30,
    head: [["Karyawan", "PT", "Gaji Pokok", "Hari Aktif", "Gaji Periode", "Lembur", "Tunjangan", "Uang Makan", "Potongan Penalti", "Potongan Lain", "Total Gaji"]],
    body: items.map((i) => [
      i.name,
      i.company ?? "-",
      formatRupiah(i.gajiPokok),
      String(i.attendance.hariKerjaAktual),
      formatRupiah(i.gajiPeriod),
      formatRupiah(i.overtime.tunjanganLembur),
      formatRupiah(i.adjustment.allowance),
      formatRupiah(i.adjustment.mealAllowance),
      i.penalty.slipLabel ?? i.penalty.warning ?? formatRupiah(0),
      formatRupiah(i.adjustment.deduction),
      formatRupiah(i.totalGaji),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [80, 50, 0] },
  });

  const totalGaji = items.reduce((s, i) => s + i.totalGaji, 0);
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;
  doc.text(`Total Payroll: ${formatRupiah(totalGaji)}`, 14, finalY + 10);

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "EXPORT_PDF",
    entity: "Payroll",
    details: periodLabel,
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payroll-${year}-${month}.pdf"`,
    },
  });
}
