import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePosTime, rebuildDailyRecap, systemActor, upsertSale, voidSale } from "@/lib/pos-sales";
import { outletCompany, outletUnpaidStatuses } from "@/lib/pos-sync";

export const runtime = "nodejs";

/**
 * Event struk dari aplikasi POS outlet (push, per transaksi).
 * Header: X-POS-Outlet, X-POS-Timestamp (unix detik), X-POS-Signature = hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
 * Kunci per outlet di .env: POS_OUTLET_KEYS='{"PETIK":"<secret>","BMCG":"<secret>"}'
 * Opsional: POS_WEBHOOK_ALLOWED_IPS="1.2.3.4,5.6.7.8"
 */
const MAX_SKEW_SECONDS = 300;
const MAX_BODY_BYTES = 64 * 1024;

function outletKeys(): Record<string, string> {
  try {
    const parsed = JSON.parse(process.env.POS_OUTLET_KEYS?.trim() || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && v.length >= 32)
        .map(([k, v]) => [k.toUpperCase(), v as string])
    );
  } catch {
    return {};
  }
}

function ipAllowed(request: NextRequest): boolean {
  const list = (process.env.POS_WEBHOOK_ALLOWED_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  const ip = request.headers.get("x-real-ip")?.trim() ?? "";
  return list.includes(ip);
}

function signatureValid(secret: string, timestamp: string, raw: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  const given = Buffer.from(signature.replace(/^sha256=/i, ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function reject(reason: string, outlet: string, request: NextRequest, status = 401) {
  await prisma.syncLog
    .create({
      data: {
        type: "POS_PUSH_REJECTED",
        status: "FAILED",
        message: `${reason} (outlet: ${outlet || "-"}, ip: ${request.headers.get("x-real-ip") ?? "-"})`.slice(0, 300),
      },
    })
    .catch(() => {});
  return NextResponse.json({ error: status === 401 ? "Unauthorized" : reason }, { status });
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(request: NextRequest) {
  const outlet = (request.headers.get("x-pos-outlet") ?? "").trim().toUpperCase();
  const timestamp = (request.headers.get("x-pos-timestamp") ?? "").trim();
  const signature = (request.headers.get("x-pos-signature") ?? "").trim();

  if (!ipAllowed(request)) return reject("IP tidak diizinkan", outlet, request, 403);

  const secret = outletKeys()[outlet];
  if (!outlet || !secret) return reject("Outlet tidak dikenal", outlet, request);

  const ts = Number(timestamp);
  if (!/^\d{9,11}$/.test(timestamp) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
    return reject("Timestamp kedaluwarsa/tidak valid", outlet, request);
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reject("Payload terlalu besar", outlet, request, 413);
  if (!/^(sha256=)?[0-9a-f]{64}$/i.test(signature) || !signatureValid(secret, timestamp, raw, signature)) {
    return reject("Tanda tangan tidak valid", outlet, request);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  }

  const event = str(body.event);
  const sale = (body.sale ?? {}) as Record<string, unknown>;
  const invoiceNo = str(sale.invoiceNo);
  if (!invoiceNo || (event !== "sale.completed" && event !== "sale.voided")) {
    return NextResponse.json({ error: "event (sale.completed/sale.voided) dan sale.invoiceNo wajib" }, { status: 400 });
  }

  const company = outletCompany(outlet);
  let dates: string[] = [];

  if (event === "sale.voided") {
    const date = await voidSale(outlet, invoiceNo, str(sale.reason) ?? "Void dari POS", "PUSH");
    if (date) dates = [date];
  } else {
    const occurredAt = typeof sale.occurredAt === "string" ? parsePosTime(sale.occurredAt) : null;
    const amount = Number(sale.amount);
    if (!occurredAt || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
      return NextResponse.json({ error: "sale.occurredAt dan sale.amount wajib valid" }, { status: 400 });
    }
    dates =
      (await upsertSale(
        outlet,
        company,
        {
          invoiceNo,
          occurredAt,
          amount,
          paymentMethod: str(sale.paymentMethod),
          qrisAmount: Number(sale.qrisAmount) || 0,
          orderType: str(sale.orderType),
          onlinePlatform: str(sale.onlinePlatform),
          cashier: str(sale.cashier),
          items: str(sale.items),
          posStatus: str(sale.status) ?? "completed",
        },
        "PUSH"
      )) ?? [];
  }

  if (dates.length > 0) {
    const stats = await rebuildDailyRecap(outlet, company, dates, await systemActor());
    if (stats.errors.length) {
      return NextResponse.json({ ok: false, error: stats.errors[0] }, { status: 422 });
    }
  }

  const current = await prisma.posSale.findUnique({
    where: { outlet_invoiceNo: { outlet, invoiceNo } },
    select: { status: true },
  });
  return NextResponse.json({ ok: true, changed: dates.length > 0, status: current?.status ?? null });
}
