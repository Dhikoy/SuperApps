import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export const ASSET_LOAN_STATUSES = ["PENDING", "ACTIVE", "RETURNED"] as const;
export type AssetLoanStatus = (typeof ASSET_LOAN_STATUSES)[number];

export const ASSET_LOAN_STATUS_LABELS: Record<AssetLoanStatus, string> = {
  PENDING: "Pending (belum upload form)",
  ACTIVE: "Dipinjam",
  RETURNED: "Dikembalikan",
};

export const MAX_LOAN_ITEMS = 20;

export const assetLoanInclude = {
  items: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.AssetLoanInclude;

export class AssetLoanError extends Error {}

function clean(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export function parseLoanHeader(body: Record<string, unknown>) {
  return {
    jobTitle: clean(body.jobTitle, 120),
    homeAddress: clean(body.homeAddress, 300),
    contact: clean(body.contact, 160),
    hrName: clean(body.hrName, 120),
    directorName: clean(body.directorName, 120),
  };
}

/** Validasi daftar barang: aset ada & tidak sedang ada di peminjaman lain yang pending/aktif. */
export async function parseLoanItems(db: Db, raw: unknown, excludeLoanId?: string) {
  if (!Array.isArray(raw) || raw.length === 0) throw new AssetLoanError("Pilih minimal 1 barang");
  if (raw.length > MAX_LOAN_ITEMS) throw new AssetLoanError(`Maksimal ${MAX_LOAN_ITEMS} barang per form`);

  const wanted = raw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return { assetId: String(row.assetId ?? ""), specification: clean(row.specification, 500) };
  });
  const ids = wanted.map((w) => w.assetId);
  if (ids.some((id) => !id)) throw new AssetLoanError("Ada barang yang belum dipilih");
  if (new Set(ids).size !== ids.length) throw new AssetLoanError("Barang yang sama dipilih lebih dari sekali");

  const assets = await db.asset.findMany({ where: { id: { in: ids } } });
  const byId = new Map(assets.map((a) => [a.id, a]));
  const busy = await db.assetLoanItem.findMany({
    where: {
      assetId: { in: ids },
      loan: { status: { in: ["PENDING", "ACTIVE"] }, ...(excludeLoanId ? { id: { not: excludeLoanId } } : {}) },
    },
    include: { loan: { select: { number: true, borrowerName: true } } },
  });
  if (busy.length > 0) {
    const b = busy[0];
    throw new AssetLoanError(`${b.assetName} (${b.serialNumber}) masih tercatat di ${b.loan.number} — ${b.loan.borrowerName}`);
  }

  return wanted.map((w, i) => {
    const asset = byId.get(w.assetId);
    if (!asset) throw new AssetLoanError("Barang tidak ditemukan");
    return {
      assetId: asset.id,
      assetName: asset.laptop,
      serialNumber: asset.serialNumber,
      specification: w.specification ?? asset.specification ?? null,
      sortOrder: i,
    };
  });
}

/** Nomor form: PB-YYYYMM-0001 (bulan Jakarta). */
export async function nextLoanNumber(db: Db, date = new Date()) {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(date)
    .replace("-", "");
  const prefix = `PB-${ym}-`;
  const last = await db.assetLoan.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export function loanErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AssetLoanError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
