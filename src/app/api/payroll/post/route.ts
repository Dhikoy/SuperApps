import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { postPayrollToFinance } from "@/lib/payroll-finance";
import { formatPeriodLabel } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "payroll:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { year, month, company, cashAccount, withholding } = await request.json();
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const pt = (company ?? "ALL").toUpperCase();

  try {
    const { posting, penaltyWarnings, breakdown, netPay } = await postPayrollToFinance(
      y,
      m,
      pt,
      session.nik,
      typeof cashAccount === "string" ? cashAccount : null,
      withholding === true
    );
    void import("@/lib/telegram/commands").then(({ notifySlipsAfterPayrollPost }) =>
      notifySlipsAfterPayrollPost(y, m, pt)
    );
    return NextResponse.json({
      posting,
      periodLabel: formatPeriodLabel(y, m),
      message: `Payroll ${pt} periode ${formatPeriodLabel(y, m)} diposting ke keuangan — dibayarkan ${formatRupiah(netPay)}${
        penaltyWarnings.length
          ? `. Peringatan potongan penalti belum masuk: ${penaltyWarnings.join("; ")}`
          : ""
      }`,
      penaltyWarnings,
      breakdown,
      netPay,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal posting payroll" },
      { status: 400 }
    );
  }
}
