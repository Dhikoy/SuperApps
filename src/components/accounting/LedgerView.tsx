"use client";

import { useEffect, useState } from "react";
import { JOURNAL_SOURCE_LABELS, formatAccounting, type JournalSourceKey } from "@/lib/accounting/constants";
import { AccountSelect } from "./AccountSelect";
import { defaultRange, rangeQuery, ReportFilterBar, type ReportRange } from "./ReportFilterBar";

type LedgerData = {
  account: { code: string; name: string; normalBalance: "DEBIT" | "CREDIT" };
  opening: number;
  rows: {
    id: string;
    date: string;
    company: string;
    number: string;
    description: string;
    source: JournalSourceKey;
    memo: string | null;
    debit: number;
    credit: number;
    balance: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
};

export function LedgerView({ initial }: { initial: { account?: string; from?: string; to?: string; company?: string } }) {
  const [range, setRange] = useState<ReportRange>(() => {
    const d = defaultRange();
    return { from: initial.from || d.from, to: initial.to || d.to, company: initial.company || "" };
  });
  const [account, setAccount] = useState(initial.account ?? "102");
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const query = rangeQuery(range, { account });

  useEffect(() => {
    if (!account) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/finance/accounting/reports/ledger?${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [account, query]);

  return (
    <div className="space-y-4">
      <ReportFilterBar value={range} onChange={setRange} exportHref={`/api/finance/accounting/reports/ledger?${query}&format=xlsx`}>
        <label className="text-xs font-medium text-slate-600 min-w-[280px]">
          Akun
          <AccountSelect value={account} onChange={setAccount} className="input-field mt-1" />
        </label>
      </ReportFilterBar>

      {data && (
        <p className="text-sm text-slate-500">
          Saldo normal akun <strong>{data.account.code} {data.account.name}</strong>:{" "}
          {data.account.normalBalance === "DEBIT" ? "debit" : "kredit"} — saldo positif berarti sesuai saldo normal.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">No. Jurnal</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Kredit</th>
              <th className="px-4 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Memuat…</td>
              </tr>
            )}
            {!loading && data && (
              <>
                <tr className="bg-slate-50/60 font-medium">
                  <td colSpan={6} className="px-4 py-2">Saldo awal</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(data.opening)}</td>
                </tr>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.number}</td>
                    <td className="px-4 py-2">{r.company}</td>
                    <td className="px-4 py-2">
                      <p>{r.description}</p>
                      <p className="text-xs text-slate-400">
                        {JOURNAL_SOURCE_LABELS[r.source]}
                        {r.memo ? ` · ${r.memo}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.debit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.credit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{formatAccounting(r.balance)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">Tidak ada mutasi di periode ini</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
          {data && !loading && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold">
                <td colSpan={4} className="px-4 py-3">Total / Saldo akhir</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatAccounting(data.totalDebit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatAccounting(data.totalCredit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatAccounting(data.closing)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
