import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jakartaDateKey } from "@/lib/penalty";
import { formatRupiah } from "@/lib/payroll-policy";
import { penaltyExportRows } from "@/lib/penalty-store";

type Ctx = { params: Promise<{ period: string }> };

function cell(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { period } = await ctx.params;
  const company = request.nextUrl.searchParams.get("company");
  const result = await penaltyExportRows(session, period, company);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { summary, details } = result;
  const rateLabel = summary.ratePerPoint == null ? "Belum ditentukan" : formatRupiah(summary.ratePerPoint);

  const summaryRows = summary.rows
    .map(
      (row) => `<tr>
        <td>${cell(row.name)}</td>
        <td>${cell(row.nik)}</td>
        <td>${cell(row.department)}</td>
        <td>${row.incidents}</td>
        <td>${row.totalPoints}</td>
        <td>${cell(rateLabel)}</td>
        <td>${row.deduction == null ? "Belum ditentukan" : cell(formatRupiah(row.deduction))}</td>
      </tr>`
    )
    .join("");

  const detailRows = details
    .map(
      (row) => `<tr>
        <td>${cell(row.user.name)}</td>
        <td>${cell(row.userId)}</td>
        <td>${cell(row.user.department?.name)}</td>
        <td>${cell(jakartaDateKey(row.date))}</td>
        <td>${row.points}</td>
        <td>${cell(row.note)}</td>
        <td>${cell(row.creator.name)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <h3>Rekap penalti ${cell(summary.company)} ${cell(period)}</h3>
    <table border="1">
      <tr><th>Nama</th><th>NIK</th><th>Divisi</th><th>Jumlah kejadian</th><th>Total poin</th><th>Rate/poin</th><th>Total potongan</th></tr>
      ${summaryRows || "<tr><td colspan='7'>Tidak ada penalti</td></tr>"}
    </table>
    <h3>Rincian per tanggal</h3>
    <table border="1">
      <tr><th>Nama</th><th>NIK</th><th>Divisi</th><th>Tanggal</th><th>Poin</th><th>Catatan</th><th>Input oleh</th></tr>
      ${detailRows || "<tr><td colspan='7'>Tidak ada rincian</td></tr>"}
    </table>
  </body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-penalti-${summary.company}-${period}.xls"`,
    },
  });
}
