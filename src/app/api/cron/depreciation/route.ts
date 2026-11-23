import { NextRequest, NextResponse } from "next/server";
import { postDepreciation } from "@/lib/accounting/depreciation";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  const q = request.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || q === secret;
}

/** Dipanggil tanggal 1 tiap bulan: posting penyusutan bulan sebelumnya untuk semua perusahaan. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  const year = ym[1] === 1 ? ym[0] - 1 : ym[0];
  const month = ym[1] === 1 ? 12 : ym[1] - 1;
  const results = await postDepreciation(year, month, null, "system");
  return NextResponse.json({ ok: true, year, month, results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
