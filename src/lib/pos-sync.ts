import { prisma } from "@/lib/prisma";
import {
  DEFAULT_UNPAID_STATUSES,
  emptyRecapStats,
  jakartaYmdOf,
  parsePosTime,
  rebuildDailyRecap,
  systemActor,
  upsertSale,
  voidSale,
  type SaleInput,
} from "@/lib/pos-sales";

/**
 * Tarik struk penjualan dari aplikasi POS outlet (Laravel, auth Sanctum).
 * Konfigurasi di .env, contoh:
 * POS_SYNC_SOURCES='[{"outlet":"BMCG","company":"LBB","baseUrl":"https://api.bmcgapp.com/api","username":"...","password":"..."}]'
 */
type PosSource = {
  outlet: string;
  company: string;
  baseUrl: string;
  username: string;
  password: string;
  unpaidStatuses: string[];
};

export type PosOutletInfo = { outlet: string; company: string; host: string };

export type PosSyncResult = {
  outlet: string;
  ok: boolean;
  days: number;
  sales: number;
  changedSales: number;
  voided: number;
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  total: number;
  errors: string[];
};

const MAX_DAYS = 400;
const DAY_MS = 86_400_000;

export function loadPosSources(): PosSource[] {
  const raw = process.env.POS_SYNC_SOURCES?.trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("POS_SYNC_SOURCES bukan JSON valid");
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item): PosSource[] => {
    if (!item || typeof item !== "object") return [];
    const s = item as Record<string, unknown>;
    const outlet = String(s.outlet ?? "").trim().toUpperCase();
    const baseUrl = String(s.baseUrl ?? "").trim().replace(/\/+$/, "");
    const username = String(s.username ?? "").trim();
    const password = String(s.password ?? "");
    if (!outlet || !baseUrl || !username || !password) return [];
    const company = String(s.company ?? "LBB").trim().toUpperCase() || "LBB";
    const unpaidStatuses = Array.isArray(s.unpaidStatuses)
      ? s.unpaidStatuses.map((v) => String(v).trim().toLowerCase()).filter(Boolean)
      : DEFAULT_UNPAID_STATUSES;
    return [{ outlet, company, baseUrl, username, password, unpaidStatuses }];
  });
}

export function outletCompany(outlet: string): string {
  return loadPosSources().find((s) => s.outlet === outlet)?.company ?? "LBB";
}

export function outletUnpaidStatuses(outlet: string): string[] {
  return loadPosSources().find((s) => s.outlet === outlet)?.unpaidStatuses ?? DEFAULT_UNPAID_STATUSES;
}

export function listPosOutlets(): PosOutletInfo[] {
  return loadPosSources().map((s) => {
    let host = s.baseUrl;
    try {
      host = new URL(s.baseUrl).host;
    } catch {}
    return { outlet: s.outlet, company: s.company, host };
  });
}

const tokenCache = new Map<string, string>();

async function login(source: PosSource): Promise<string> {
  const res = await fetch(`${source.baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: source.username, password: source.password }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { token?: unknown; message?: unknown };
  if (!res.ok || typeof body.token !== "string") {
    const reason = typeof body.message === "string" ? body.message : `HTTP ${res.status}`;
    throw new Error(`Login POS ${source.outlet} gagal: ${reason}`);
  }
  tokenCache.set(source.outlet, body.token);
  return body.token;
}

async function posGet(source: PosSource, path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = tokenCache.get(source.outlet) ?? (await login(source));
    const res = await fetch(`${source.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (res.status === 401) {
      tokenCache.delete(source.outlet);
      continue;
    }
    if (!res.ok) throw new Error(`POS ${source.outlet} ${path}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`POS ${source.outlet}: token ditolak setelah login ulang`);
}

function itemsSummary(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  const parts = details.flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const row = d as Record<string, unknown>;
    const ref = (row.menu ?? row.product) as Record<string, unknown> | null | undefined;
    const name = String(ref?.menu_name ?? ref?.product_name ?? ref?.name ?? row.name ?? "").trim();
    if (!name) return [];
    const qty = Number(row.qty);
    return [Number.isFinite(qty) && qty > 0 ? `${name} x${qty}` : name];
  });
  return parts.length ? parts.join(", ") : null;
}

/** Petakan baris transaksi POS mentah ke struk SuperApps; null jika data inti tidak lengkap. */
export function mapPosTransaction(row: unknown): SaleInput | null {
  if (!row || typeof row !== "object") return null;
  const t = row as Record<string, unknown>;
  const invoiceNo = String(t.invoice_no ?? t.id ?? "").trim();
  const rawDate = t.transaction_date ?? t.created_at;
  const occurredAt = typeof rawDate === "string" ? parsePosTime(rawDate) : null;
  const amount = Number(t.grand_total);
  if (!invoiceNo || !occurredAt || !Number.isFinite(amount)) return null;
  const user = t.user as Record<string, unknown> | null | undefined;
  return {
    invoiceNo,
    occurredAt,
    amount,
    paymentMethod: typeof t.payment_method === "string" ? t.payment_method : null,
    qrisAmount: Number(t.qris_amount) || 0,
    orderType: typeof t.order_type === "string" ? t.order_type : null,
    onlinePlatform: typeof t.online_platform === "string" ? t.online_platform : null,
    cashier: typeof user?.name === "string" ? user.name : null,
    items: itemsSummary(t.details),
    posStatus: typeof t.status === "string" ? t.status : null,
  };
}

function todayJakarta(): string {
  return jakartaYmdOf(new Date());
}

function shiftYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

async function syncSource(source: PosSource, days: number, actor: string): Promise<PosSyncResult> {
  const result: PosSyncResult = {
    outlet: source.outlet,
    ok: false,
    days,
    sales: 0,
    changedSales: 0,
    voided: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    total: 0,
    errors: [],
  };

  const to = todayJakarta();
  const from = shiftYmd(to, -(days - 1));
  const data = await posGet(source, "/transactions");
  if (!Array.isArray(data)) throw new Error(`POS ${source.outlet}: format data transaksi tidak dikenali`);

  const affected = new Set<string>();
  const seen = new Set<string>();
  let oldestFetched: string | null = null;

  for (const row of data) {
    const sale = mapPosTransaction(row);
    if (!sale) continue;
    const date = jakartaYmdOf(sale.occurredAt);
    if (!oldestFetched || date < oldestFetched) oldestFetched = date;
    if (date < from || date > to) continue;
    seen.add(sale.invoiceNo);
    result.sales += 1;
    try {
      const dates = await upsertSale(source.outlet, source.company, sale, "PULL", source.unpaidStatuses);
      if (dates) {
        result.changedSales += 1;
        dates.forEach((d) => affected.add(d));
      }
    } catch (error) {
      result.errors.push(`${sale.invoiceNo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Hanya void struk yang hilang di rentang yang benar-benar tercakup data POS (antisipasi API terpotong/paging)
  const coveredFrom = oldestFetched && oldestFetched > from ? shiftYmd(oldestFetched, 1) : from;
  const missing = oldestFetched
    ? await prisma.posSale.findMany({
        where: { outlet: source.outlet, status: { in: ["COMPLETED", "PENDING"] }, saleDate: { gte: coveredFrom, lte: to } },
      })
    : [];
  for (const m of missing) {
    if (seen.has(m.invoiceNo)) continue;
    const date = await voidSale(source.outlet, m.invoiceNo, "Tidak ada lagi di POS (dihapus/void)", "PULL");
    if (date) {
      result.voided += 1;
      affected.add(date);
    }
  }

  const recapRefs = await prisma.posTransaction.findMany({
    where: { outlet: source.outlet, externalRef: { startsWith: `POS:${source.outlet}:` } },
    select: { externalRef: true },
  });
  for (const r of recapRefs) {
    const date = r.externalRef!.slice(`POS:${source.outlet}:`.length, `POS:${source.outlet}:`.length + 10);
    if (date >= from && date <= to) affected.add(date);
  }

  const stats = await rebuildDailyRecap(source.outlet, source.company, affected, actor, emptyRecapStats());
  result.created = stats.created;
  result.updated = stats.updated;
  result.unchanged = stats.unchanged;
  result.removed = stats.removed;
  result.errors.push(...stats.errors);

  const totals = await prisma.posSale.aggregate({
    where: { outlet: source.outlet, status: "COMPLETED", saleDate: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  result.total = Math.round(totals._sum.amount ?? 0);
  result.ok = result.errors.length === 0;
  return result;
}

export async function runPosSync(opts: { days?: number; outlet?: string } = {}): Promise<PosSyncResult[]> {
  const days = Math.min(MAX_DAYS, Math.max(1, Math.floor(opts.days ?? 3)));
  const sources = loadPosSources().filter((s) => !opts.outlet || s.outlet === opts.outlet.toUpperCase());
  if (sources.length === 0) return [];

  const actor = await systemActor();
  const results: PosSyncResult[] = [];
  for (const source of sources) {
    let result: PosSyncResult;
    try {
      result = await syncSource(source, days, actor);
    } catch (error) {
      result = {
        outlet: source.outlet,
        ok: false,
        days,
        sales: 0,
        changedSales: 0,
        voided: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        removed: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
    results.push(result);
    await prisma.syncLog.create({
      data: {
        type: `POS_SYNC:${source.outlet}`,
        status: result.ok ? "SUCCESS" : "FAILED",
        message: result.ok
          ? `${days} hari: ${result.sales} struk (${result.changedSales} berubah, ${result.voided} void)`
          : result.errors.slice(0, 3).join(" | "),
        payload: JSON.stringify(result),
      },
    });
  }
  return results;
}

export async function lastPosSyncLogs() {
  const outlets = listPosOutlets();
  const logs = await Promise.all(
    outlets.map((o) =>
      prisma.syncLog.findFirst({
        where: { type: `POS_SYNC:${o.outlet}` },
        orderBy: { createdAt: "desc" },
        select: { status: true, message: true, createdAt: true },
      })
    )
  );
  const lastPush = await Promise.all(
    outlets.map((o) =>
      prisma.posSale.findFirst({
        where: { outlet: o.outlet, source: "PUSH" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      })
    )
  );
  return outlets.map((o, i) => ({ ...o, lastSync: logs[i], lastPushAt: lastPush[i]?.updatedAt ?? null }));
}
