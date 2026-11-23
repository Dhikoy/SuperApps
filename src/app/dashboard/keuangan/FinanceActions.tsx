"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountSelect } from "@/components/accounting/AccountSelect";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";
import { formatRupiah } from "@/lib/payroll-policy";

type Props = {
  requestId: string;
  action: "approve" | "reject" | "pay" | "realize";
  stageLabel: string;
  showPaymentRef?: boolean;
  showRealizationNote?: boolean;
  totalAmount?: number;
};

export function FinanceActions({
  requestId,
  action,
  stageLabel,
  showPaymentRef,
  showRealizationNote,
  totalAmount = 0,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paidFromAccount, setPaidFromAccount] = useState<string>(DEFAULT_ACCOUNTS.cash);
  const [realizationNote, setRealizationNote] = useState("");
  const [realizedAmount, setRealizedAmount] = useState(String(totalAmount));

  const actual = Number(realizedAmount);
  const diff = Number.isFinite(actual) ? totalAmount - actual : 0;

  async function handleAction(act: "approve" | "reject" | "pay" | "realize") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/finance/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: act,
        paymentRef: paymentRef || undefined,
        realizationNote: realizationNote || undefined,
        ...(act === "pay" ? { paidFromAccount } : {}),
        ...(act === "realize" ? { realizedAmount: realizedAmount === "" ? undefined : actual } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Gagal memproses");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-xs text-slate-500 mb-3">{stageLabel}</p>
      {showPaymentRef && (
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <label className="text-xs font-medium text-slate-600">
            Dibayar dari (Kas/Bank)
            <AccountSelect value={paidFromAccount} onChange={setPaidFromAccount} cashOnly className="input-field mt-1" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            No. referensi
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Opsional"
              className="input-field mt-1"
            />
          </label>
        </div>
      )}
      {showRealizationNote && (
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <label className="text-xs font-medium text-slate-600">
            Nominal aktual terpakai
            <input
              type="number"
              min="0"
              value={realizedAmount}
              onChange={(e) => setRealizedAmount(e.target.value)}
              className="input-field mt-1"
            />
            {diff !== 0 && (
              <span className={`mt-1 block ${diff > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {diff > 0
                  ? `Sisa ${formatRupiah(diff)} dikembalikan ke kas/bank`
                  : `Kurang ${formatRupiah(-diff)} dibayarkan dari kas/bank`}
              </span>
            )}
          </label>
          <label className="text-xs font-medium text-slate-600">
            Catatan realisasi
            <input
              type="text"
              value={realizationNote}
              onChange={(e) => setRealizationNote(e.target.value)}
              placeholder="Opsional"
              className="input-field mt-1"
            />
          </label>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {action === "approve" && (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : "Setujui"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "..." : "Tolak"}
            </button>
          </>
        )}
        {action === "pay" && (
          <button
            onClick={() => handleAction("pay")}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? "..." : "Tandai Sudah Dibayar"}
          </button>
        )}
        {action === "realize" && (
          <button
            onClick={() => handleAction("realize")}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "..." : "Realisasi Selesai"}
          </button>
        )}
      </div>
    </div>
  );
}
