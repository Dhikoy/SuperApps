import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import {
  balanceSheet,
  generalLedger,
  parseReportFilter,
  profitLoss,
  todayJakarta,
  trialBalance,
} from "@/lib/accounting/reports";
import {
  agingXlsx,
  balanceSheetXlsx,
  budgetXlsx,
  cashFlowXlsx,
  generalLedgerXlsx,
  profitLossXlsx,
  trialBalanceXlsx,
} from "@/lib/accounting/reports-xlsx";
import { budgetVsActual, cashFlow, receivableAging } from "@/lib/accounting/reports-extra";

type Ctx = { params: Promise<{ type: string }> };

function xlsxResponse(buffer: Buffer, name: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const filter = parseReportFilter(params);
  const asXlsx = params.get("format") === "xlsx";
  const suffix = `${filter.company ?? "ALL"}-${filter.from}_${filter.to}`;

  if (type === "trial-balance") {
    const data = await trialBalance(filter, { showAll: params.get("all") === "1" });
    return asXlsx ? xlsxResponse(await trialBalanceXlsx(data), `neraca-saldo-${suffix}`) : NextResponse.json(data);
  }

  if (type === "profit-loss") {
    const data = await profitLoss(filter);
    return asXlsx ? xlsxResponse(await profitLossXlsx(data), `laba-rugi-${suffix}`) : NextResponse.json(data);
  }

  if (type === "balance-sheet") {
    const asOfParam = params.get("asOf") ?? "";
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfParam) ? asOfParam : todayJakarta();
    const data = await balanceSheet({ asOf, company: filter.company });
    return asXlsx
      ? xlsxResponse(await balanceSheetXlsx(data), `neraca-${filter.company ?? "ALL"}-${asOf}`)
      : NextResponse.json(data);
  }

  if (type === "ledger") {
    const accountCode = (params.get("account") ?? "").trim();
    if (!accountCode) return NextResponse.json({ error: "Pilih akun" }, { status: 400 });
    const data = await generalLedger({ ...filter, accountCode });
    if (!data) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
    return asXlsx
      ? xlsxResponse(await generalLedgerXlsx(data), `buku-besar-${accountCode}-${suffix}`)
      : NextResponse.json(data);
  }

  if (type === "aging") {
    const asOfParam = params.get("asOf") ?? "";
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfParam) ? asOfParam : todayJakarta();
    const data = await receivableAging({ asOf, company: filter.company });
    return asXlsx
      ? xlsxResponse(await agingXlsx(data), `umur-piutang-${filter.company ?? "ALL"}-${asOf}`)
      : NextResponse.json(data);
  }

  if (type === "cash-flow") {
    const data = await cashFlow(filter);
    return asXlsx ? xlsxResponse(await cashFlowXlsx(data), `arus-kas-${suffix}`) : NextResponse.json(data);
  }

  if (type === "budget") {
    const data = await budgetVsActual(filter);
    return asXlsx ? xlsxResponse(await budgetXlsx(data), `anggaran-${suffix}`) : NextResponse.json(data);
  }

  return NextResponse.json({ error: "Laporan tidak dikenal" }, { status: 404 });
}
