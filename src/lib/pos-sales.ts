import { prisma } from "@/lib/prisma";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";
import { deletePosTransaction, upsertPosByRef } from "@/lib/pos";

export const CHANNELS: Record<string, { label: string; online: boolean }> = {
  cash: { label: "Tunai", online: false },
  qris: { label: "QRIS", online: false },
  grabfood: { label: "GrabFood", online: true },
  shopeefood: { label: "ShopeeFood", online: true },
  gofood: { label: "GoFood", online: true },
};

const ONLINE_INCOME_ACCOUNT = "419";
const OFFLINE_INCOME_ACCOUNT = DEFAULT_ACCOUNTS.posIncome;
const NON_CASH_ACCOUNT = "108";
const VOID_POS_STATUSES = new Set(["cancelled", "canceled", "void", "voided", "refunded"]);
export const DEFAULT_UNPAID_STATUSES = ["pending", "unpaid"];

export type SaleStatus = "COMPLETED" | "PENDING" | "VOID";
const JAKARTA_OFFSET_MS = 7 * 3_600_000;

export type SaleInput = {
  invoiceNo: string;
  occurredAt: Date;
  amount: number;
  paymentMethod?: string | null;
  qrisAmount?: number | null;
  orderType?: string | null;
  onlinePlatform?: string | null;
  cashier?: string | null;
  items?: string | null;
  posStatus?: string | null;
};

export type SaleSource = "PULL" | "PUSH";

export function channelLabel(channel: string): string {
  return CHANNELS[channel]?.label ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

/** Waktu dari POS: ISO dengan zona (UTC) atau waktu lokal Jakarta tanpa zona. */
export function parsePosTime(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00+07:00`);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasZone ? s : `${s.replace(" ", "T")}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function jakartaYmdOf(d: Date): string {
  return new Date(d.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function jakartaYmd(raw: string): string | null {
  const d = parsePosTime(raw);
  return d ? jakartaYmdOf(d) : null;
}

export function isVoidPosStatus(status: string | null | undefined): boolean {
  return VOID_POS_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

/** Pecah nominal ke kanal; online -> platform, split (Petik) -> bagian QRIS + sisa tunai. */
export function allocateChannels(sale: {
  amount: number;
  paymentMethod?: string | null;
  qrisAmount?: number | null;
  orderType?: string | null;
  onlinePlatform?: string | null;
}): [string, number][] {
  const platform = String(sale.onlinePlatform ?? "").trim().toLowerCase();
  if (String(sale.orderType ?? "").toLowerCase() === "online" && platform) return [[platform, sale.amount]];
  const method = String(sale.paymentMethod ?? "").trim().toLowerCase() || "lainnya";
  if (method === "split") {
    const qris = Math.min(sale.amount, Math.max(0, Number(sale.qrisAmount) || 0));
    const parts: [string, number][] = [
      ["qris", qris],
      ["cash", sale.amount - qris],
    ];
    return parts.filter(([, v]) => v > 0);
  }
  return [[method, sale.amount]];
}

function clean(value: string | null | undefined, max: number): string | null {
  const v = String(value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

/**
 * Simpan/perbarui struk. VOID bersifat final: struk yang sudah void tidak bisa aktif lagi.
 * Mengembalikan tanggal yang terdampak (untuk hitung ulang rekap) atau null jika tidak berubah.
 */
export async function upsertSale(
  outlet: string,
  company: string,
  input: SaleInput,
  source: SaleSource,
  unpaidStatuses: Iterable<string> = DEFAULT_UNPAID_STATUSES
): Promise<string[] | null> {
  const invoiceNo = input.invoiceNo.trim().slice(0, 100);
  const saleDate = jakartaYmdOf(input.occurredAt);
  const voided = isVoidPosStatus(input.posStatus);
  const unpaid = new Set(Array.from(unpaidStatuses, (s) => s.toLowerCase()));
  const status: SaleStatus = voided
    ? "VOID"
    : unpaid.has(String(input.posStatus ?? "").trim().toLowerCase())
      ? "PENDING"
      : "COMPLETED";
  const data = {
    company,
    saleDate,
    occurredAt: input.occurredAt,
    amount: Math.round(input.amount * 100) / 100,
    paymentMethod: clean(input.paymentMethod, 30)?.toLowerCase() ?? null,
    qrisAmount: Math.max(0, Number(input.qrisAmount) || 0),
    orderType: clean(input.orderType, 30)?.toLowerCase() ?? null,
    onlinePlatform: clean(input.onlinePlatform, 30)?.toLowerCase() ?? null,
    cashier: clean(input.cashier, 100),
    items: clean(input.items, 1000),
    posStatus: clean(input.posStatus, 30)?.toLowerCase() ?? null,
  };

  const existing = await prisma.posSale.findUnique({ where: { outlet_invoiceNo: { outlet, invoiceNo } } });

  if (!existing) {
    await prisma.posSale.create({
      data: {
        outlet,
        invoiceNo,
        ...data,
        status,
        voidedAt: voided ? new Date() : null,
        voidReason: voided ? `Status POS: ${data.posStatus}` : null,
        source,
      },
    });
    return [saleDate];
  }

  if (existing.status === "VOID") return null;

  const same =
    existing.saleDate === data.saleDate &&
    existing.amount === data.amount &&
    existing.paymentMethod === data.paymentMethod &&
    existing.qrisAmount === data.qrisAmount &&
    existing.orderType === data.orderType &&
    existing.onlinePlatform === data.onlinePlatform &&
    existing.cashier === data.cashier &&
    existing.items === data.items &&
    existing.posStatus === data.posStatus &&
    existing.status === status;
  if (same) return null;

  await prisma.posSale.update({
    where: { id: existing.id },
    data: {
      ...data,
      status,
      ...(voided ? { voidedAt: new Date(), voidReason: `Status POS: ${data.posStatus}` } : {}),
      source,
    },
  });
  return Array.from(new Set([existing.saleDate, saleDate]));
}

export async function voidSale(
  outlet: string,
  invoiceNo: string,
  reason: string,
  source: SaleSource
): Promise<string | null> {
  const existing = await prisma.posSale.findUnique({
    where: { outlet_invoiceNo: { outlet, invoiceNo: invoiceNo.trim().slice(0, 100) } },
  });
  if (!existing || existing.status === "VOID") return null;
  await prisma.posSale.update({
    where: { id: existing.id },
    data: { status: "VOID", voidedAt: new Date(), voidReason: reason.slice(0, 200), source },
  });
  return existing.saleDate;
}

export type RecapStats = { created: number; updated: number; unchanged: number; removed: number; errors: string[] };

export function emptyRecapStats(): RecapStats {
  return { created: 0, updated: 0, unchanged: 0, removed: 0, errors: [] };
}

function recapPrefix(outlet: string) {
  return `POS:${outlet}:`;
}

/** Hitung ulang rekap harian per kanal (PosTransaction + pendapatan + jurnal) dari struk COMPLETED. */
export async function rebuildDailyRecap(
  outlet: string,
  company: string,
  dates: Iterable<string>,
  actor: string,
  stats: RecapStats = emptyRecapStats()
): Promise<RecapStats> {
  const prefix = recapPrefix(outlet);

  for (const date of new Set(dates)) {
    const sales = await prisma.posSale.findMany({ where: { outlet, saleDate: date, status: "COMPLETED" } });
    const groups = new Map<string, { amount: number; count: number }>();
    for (const sale of sales) {
      for (const [channel, part] of allocateChannels(sale)) {
        const g = groups.get(channel) ?? { amount: 0, count: 0 };
        g.amount += part;
        g.count += 1;
        groups.set(channel, g);
      }
    }

    for (const [channel, g] of groups) {
      const online = CHANNELS[channel]?.online ?? false;
      try {
        const outcome = await upsertPosByRef(
          {
            company,
            outlet,
            type: "SALE",
            amount: Math.round(g.amount),
            description: `${outlet} · Penjualan ${channelLabel(channel)} (${g.count} trx)`,
            transactionDate: date,
            externalRef: `${prefix}${date}:${channel}`,
            accountCode: online ? ONLINE_INCOME_ACCOUNT : OFFLINE_INCOME_ACCOUNT,
            cashAccount: channel === "cash" ? DEFAULT_ACCOUNTS.pettyCash : NON_CASH_ACCOUNT,
          },
          actor
        );
        stats[outcome] += 1;
      } catch (error) {
        stats.errors.push(`${date} ${channelLabel(channel)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const stale = await prisma.posTransaction.findMany({
      where: { externalRef: { startsWith: `${prefix}${date}:` } },
      select: { id: true, externalRef: true },
    });
    for (const row of stale) {
      const channel = row.externalRef!.slice(`${prefix}${date}:`.length);
      if (groups.has(channel)) continue;
      try {
        await prisma.$transaction((tx) => deletePosTransaction(tx, row.id));
        stats.removed += 1;
      } catch (error) {
        stats.errors.push(`hapus ${date} ${channel}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return stats;
}

export async function systemActor(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { role: { in: ["KEUANGAN", "SUPER_ADMIN"] } },
    select: { nik: true },
  });
  if (!user) throw new Error("Belum ada user Keuangan/Super Admin untuk pencatat POS");
  return user.nik;
}
