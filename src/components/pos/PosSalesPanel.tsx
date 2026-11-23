"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/payroll-policy";

type PosSaleRow = {
  id: string;
  outlet: string;
  invoiceNo: string;
  saleDate: string;
  occurredAt: string;
  amount: number;
  paymentMethod: string | null;
  qrisAmount: number;
  orderType: string | null;
  onlinePlatform: string | null;
  cashier: string | null;
  items: string | null;
  posStatus: string | null;
  status: string;
  voidedAt: string | null;
  voidReason: string | null;
  source: string;
};

type SalesData = {
  sales: PosSaleRow[];
  completed: { count: number; amount: number };
  pending: { count: number; amount: number };
  voided: { count: number; amount: number };
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Tunai", qris: "QRIS", split: "Split" };
const PLATFORM_LABELS: Record<string, string> = { grabfood: "GrabFood", shopeefood: "ShopeeFood", gofood: "GoFood" };

function channelText(s: PosSaleRow): string {
  if (s.orderType === "online" && s.onlinePlatform) return PLATFORM_LABELS[s.onlinePlatform] ?? s.onlinePlatform;
  const method = s.paymentMethod ?? "-";
  if (method === "split") return `Split (QRIS ${formatRupiah(s.qrisAmount)})`;
  return PAYMENT_LABELS[method] ?? method;
}

export function PosSalesPanel({ outlet, year, month, refreshKey }: { outlet: string; year: number; month: number; refreshKey: number }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SalesData | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    if (outlet && outlet !== "MANUAL") qs.set("outlet", outlet);
    if (status) qs.set("status", status);
    if (query) qs.set("q", query);
    fetch(`/api/integrations/pos/sales?${qs}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [outlet, year, month, status, query, refreshKey]);

  if (outlet === "MANUAL") {
    return <p className="text-sm text-slate-500">Input manual tidak punya data per struk.</p>;
  }

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white border p-4">
            <p className="text-xs text-slate-500">Struk sah (masuk keuangan)</p>
            <p className="text-lg font-bold text-emerald-600">{formatRupiah(data.completed.amount)}</p>
            <p className="text-xs text-slate-400">{data.completed.count} transaksi</p>
          </div>
          <div className="rounded-xl bg-white border p-4">
            <p className="text-xs text-slate-500">Pending (belum masuk keuangan)</p>
            <p className="text-lg font-bold text-amber-600">{formatRupiah(data.pending.amount)}</p>
            <p className="text-xs text-slate-400">{data.pending.count} transaksi</p>
          </div>
          <div className="rounded-xl bg-white border p-4">
            <p className="text-xs text-slate-500">Void / batal (tidak dihitung)</p>
            <p className="text-lg font-bold text-red-600">{formatRupiah(data.voided.amount)}</p>
            <p className="text-xs text-slate-400">{data.voided.count} transaksi</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari invoice, item, kasir..."
          className="input-field !w-auto flex-1 min-w-[200px]"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field !w-auto">
          <option value="">Semua status</option>
          <option value="COMPLETED">Sah</option>
          <option value="PENDING">Pending</option>
          <option value="VOID">Void</option>
        </select>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Outlet / Invoice</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Kanal</th>
              <th className="px-4 py-3">Kasir</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.sales.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Belum ada struk di periode ini</td></tr>
            )}
            {data?.sales.map((s) => {
              const isVoid = s.status === "VOID";
              const isPending = s.status === "PENDING";
              return (
                <tr key={s.id} className={isVoid ? "bg-red-50/40 text-slate-400" : isPending ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(s.occurredAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{s.outlet}</span>
                    <span className="block text-[11px] font-mono">{s.invoiceNo}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <span className="line-clamp-2" title={s.items ?? ""}>{s.items ?? "-"}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{channelText(s)}</td>
                  <td className="px-4 py-3">{s.cashier ?? "-"}</td>
                  <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${isVoid ? "line-through" : ""}`}>
                    {formatRupiah(s.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {isVoid ? (
                      <span title={s.voidReason ?? ""} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        Void
                      </span>
                    ) : isPending ? (
                      <span title="Belum dibayar — tidak masuk keuangan" className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Pending
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Sah{s.posStatus && s.posStatus !== "completed" ? ` · ${s.posStatus}` : ""}
                      </span>
                    )}
                    {isVoid && s.voidReason && <span className="block text-[11px] mt-1">{s.voidReason}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
