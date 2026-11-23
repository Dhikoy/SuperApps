import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLE_LABELS, type Role } from "@/lib/roles";
import { formatPeriodLabelForMode, getCalendarMonthForDate, getCalendarMonthRange, type PeriodMode } from "@/lib/period";
import { dedupeAttendanceRows } from "@/lib/attendance-dedupe";
import { attendanceScopeUserWhere } from "@/lib/attendance-scope";
import { summarizeAttendances } from "@/lib/attendance-summary";
import { getJakartaTodayEnd } from "@/lib/timezone";
import { getAttendanceAnalysis } from "@/lib/attendance-analysis-server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "attendance:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const defaultPeriod = getCalendarMonthForDate();
  const year = parseInt(searchParams.get("year") ?? String(defaultPeriod.year), 10);
  const month = parseInt(searchParams.get("month") ?? String(defaultPeriod.month), 10);
  const userId = searchParams.get("userId") ?? undefined;
  const format = searchParams.get("format");
  const view = searchParams.get("view");
  const company = searchParams.get("company") || undefined;

  if (view === "analysis" && (format === "csv" || format === "pdf")) {
    const analysis = await getAttendanceAnalysis({ year, month, company });

    if (format === "csv") {
      const columns = [
        "Karyawan", "PT", "Hari Wajib", "Masuk", "Lengkap Masuk-Pulang",
        "Alpha/Tidak Masuk", "Lupa Pulang", "Foto Masuk", "Foto Pulang",
        "Kepatuhan", "Risiko", "Indikasi Otomatis", "Penyebab HR",
        "Tindak Lanjut", "Status",
      ];
      const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = analysis.rows.map((row) =>
        [
          row.name,
          row.company ?? "-",
          row.requiredDays,
          row.clockInDays,
          row.completeDays,
          row.noClockInDays,
          row.missingClockOutDays,
          `${row.clockInPhotoCount}/${row.clockInDays}`,
          `${row.clockOutPhotoCount}/${row.completeDays}`,
          `${row.compliancePercentage}%`,
          row.risk,
          row.indications.join("; ") || "Tidak ada indikasi",
          row.review?.confirmedCause ?? "",
          row.review?.followUp ?? "",
          row.review?.status ?? "BELUM_DIKONFIRMASI",
        ].map(csvCell).join(",")
      );
      const csv = `\uFEFF# Analisa Permasalahan Presensi\n# ${analysis.periodLabel}\n${columns
        .map(csvCell)
        .join(",")}\n${rows.join("\n")}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analisa-presensi-${analysis.period}.csv"`,
        },
      });
    }

    const doc = new jsPDF({ orientation: "landscape", format: "a3" });
    doc.setFontSize(16);
    doc.text("SuperApps BCI — Analisa Permasalahan Presensi", 14, 16);
    doc.setFontSize(10);
    doc.text(analysis.periodLabel, 14, 23);
    doc.text(
      `Risiko tinggi: ${analysis.summary.highRisk}  |  Risiko sedang: ${analysis.summary.mediumRisk}  |  Belum pernah absen: ${analysis.summary.neverClockedIn}  |  Sering tidak clock-out: ${analysis.summary.oftenMissingClockOut}`,
      14,
      30
    );
    doc.setFontSize(8);
    doc.text(
      "Indikasi otomatis dihitung dari data presensi. Penyebab HR adalah hasil konfirmasi manusia. Foto wajah tidak disertakan; hanya kelengkapannya.",
      14,
      36
    );
    autoTable(doc, {
      startY: 42,
      head: [[
        "Karyawan", "PT", "Wajib", "Masuk", "Lengkap", "Tidak Masuk",
        "Lupa Pulang", "Foto In/Out", "Patuh", "Risiko", "Indikasi",
        "Penyebab HR", "Tindak Lanjut", "Status",
      ]],
      body: analysis.rows.map((row) => [
        row.name,
        row.company ?? "-",
        String(row.requiredDays),
        String(row.clockInDays),
        String(row.completeDays),
        String(row.noClockInDays),
        String(row.missingClockOutDays),
        `${row.clockInPhotoCount}/${row.clockInDays} | ${row.clockOutPhotoCount}/${row.completeDays}`,
        `${row.compliancePercentage}%`,
        row.risk,
        row.indications.join("; ") || "-",
        row.review?.confirmedCause ?? "-",
        row.review?.followUp ?? "-",
        row.review?.status ?? "BELUM_DIKONFIRMASI",
      ]),
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 35, 50] },
    });
    return new NextResponse(Buffer.from(doc.output("arraybuffer")), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="analisa-presensi-${analysis.period}.pdf"`,
      },
    });
  }

  const mode: PeriodMode = "calendar";

  const { start, end: periodEnd } = getCalendarMonthRange(year, month);
  const todayEnd = getJakartaTodayEnd();
  const end = periodEnd.getTime() > todayEnd.getTime() ? todayEnd : periodEnd;
  const periodLabel = formatPeriodLabelForMode(year, month, mode);

  const attendances = dedupeAttendanceRows(
    await prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { name: true, userId: true, role: true } },
        jamKerja: { select: { shiftName: true, standardClockIn: true } },
      },
      orderBy: [{ user: { name: "asc" } }, { date: "desc" }],
    })
  );

  const summary = await prisma.user.findMany({
    where: {
      ...attendanceScopeUserWhere(),
      ...(userId ? { nik: userId } : {}),
    },
    select: {
      nik: true,
      name: true,
      userId: true,
      role: true,
      attendances: {
        where: { date: { gte: start, lte: end } },
        select: { status: true, clockInTime: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const summaryData = summary.map((u) => ({
    nik: u.nik,
    name: u.name,
    userId: u.userId,
    role: u.role,
    ...summarizeAttendances(u.attendances),
  }));

  if (format === "csv") {
    const header =
      "Nama,User ID,Role,Total Masuk,Hadir,Terlambat,Izin,Alpha,Tanggal,Clock In,Clock Out,Shift,Status,Selfie In,Selfie Out\n";
    const summaryRows = summaryData.map((s) =>
      [
        s.name,
        s.userId,
        ROLE_LABELS[s.role as Role] ?? s.role,
        s.totalMasuk,
        s.totalHadir,
        s.totalTerlambat,
        s.totalIzin,
        s.totalAlpha,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const detailRows = attendances.map((a) =>
      [
        a.user.name,
        a.user.userId,
        ROLE_LABELS[a.user.role as Role] ?? a.user.role,
        "",
        "",
        "",
        "",
        "",
        a.date.toLocaleDateString("id-ID"),
        a.clockInTime ?? "",
        a.clockOutTime ?? "",
        a.jamKerja?.shiftName ?? "",
        a.status,
        a.selfieImage ? "Ya" : "Tidak",
        a.clockOutSelfieImage ? "Ya" : "Tidak",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = `# ${periodLabel}\n${header}${summaryRows.join("\n")}\n${detailRows.join("\n")}`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan-presensi-${year}-${month}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("SuperApps BCI — Laporan Presensi", 14, 16);
    doc.setFontSize(10);
    doc.text(periodLabel, 14, 24);
    doc.text(
      "Periode: bulan kalender (1 s/d akhir bulan)",
      14,
      30
    );

    autoTable(doc, {
      startY: 36,
      head: [["Karyawan", "User ID", "Role", "Total Masuk", "Hadir", "Terlambat", "Izin", "Alpha"]],
      body: summaryData.map((s) => [
        s.name,
        s.userId,
        ROLE_LABELS[s.role as Role] ?? s.role,
        String(s.totalMasuk),
        String(s.totalHadir),
        String(s.totalTerlambat),
        String(s.totalIzin),
        String(s.totalAlpha),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [26, 35, 50] },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 36;

    autoTable(doc, {
      startY: finalY + 8,
      head: [["Karyawan", "Tanggal", "Clock In", "Clock Out", "Shift", "Status", "Selfie In", "Selfie Out"]],
      body: attendances.map((a) => [
        a.user.name,
        a.date.toLocaleDateString("id-ID"),
        a.clockInTime ?? "-",
        a.clockOutTime ?? "-",
        a.jamKerja?.shiftName ?? "-",
        a.status,
        a.selfieImage ? "Ya" : "Tidak",
        a.clockOutSelfieImage ? "Ya" : "Tidak",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [26, 35, 50] },
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-presensi-${year}-${month}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    year,
    month,
    mode,
    periodLabel,
    attendances,
    summary: summaryData,
  });
}
