"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ACCOUNT_GROUP_LABELS, formatAccounting, type AccountGroupKey } from "@/lib/accounting/constants";
import { defaultRange, rangeQuery, ReportFilterBar, type ReportRange } from "./ReportFilterBar";

type Row = { code: string; name: string; group: AccountGroupKey; opening: number; debit: number; credit: number; closing: number };
type Data = { rows: Row[]; totals: Omit<Row, "code" | "name" | "group">; balanced: boolean };

export function TrialBalanceView() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const query = rangeQuery(range, showAll ? { all: "1" } : {});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/finance/accounting/reports/trial-balance?${query}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  const groups = (Object.keys(ACCOUNT_GROUP_LABELS) as AccountGroupKey[]).map((g) => ({
    group: g,
    rows: data?.rows.filter((r) => r.group === g) ?? [],
  }));

  return (
    <div className="space-y-4">
      <ReportFilterBar
        value={range}
        onChange={setRange}
        exportHref={`/api/finance/accounting/reports/trial-balance?${query}&format=xlsx`}
      >
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Tampilkan akun tanpa mutasi
        </label>
      </ReportFilterBar>

      {data && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            data.balanced ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {data.balanced
            ? `Seimbang — total debit = total kredit = ${formatAccounting(data.totals.debit)}`
            : `Tidak seimbang — debit ${formatAccounting(data.totals.debit)} vs kredit ${formatAccounting(data.totals.credit)}`}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3 text-right">Saldo Awal (D−K)</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Kredit</th>
              <th className="px-4 py-3 text-right">Saldo Akhir (D−K)</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Memuat…</td>
              </tr>
            )}
            {!loading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada jurnal di periode ini</td>
              </tr>
            )}
            {!loading &&
              groups.map(({ group, rows }) =>
                rows.length === 0 ? null : (
                  <GroupRows key={group} label={ACCOUNT_GROUP_LABELS[group]} rows={rows} range={range} />
                )
              )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold">
                <td className="px-4 py-3" colSpan={2}>TOTAL MUTASI</td>
                <td className="px-4 py-3 text-right">{formatAccounting(data.totals.opening)}</td>
                <td className="px-4 py-3 text-right">{formatAccounting(data.totals.debit)}</td>
                <td className="px-4 py-3 text-right">{formatAccounting(data.totals.credit)}</td>
                <td className="px-4 py-3 text-right">{formatAccounting(data.totals.closing)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function GroupRows({ label, rows, range }: { label: string; rows: Row[]; range: ReportRange }) {
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase text-slate-500">{label}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.code} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="px-4 py-2 font-mono">{r.code}</td>
          <td className="px-4 py-2">
            <Link
              href={`/dashboard/keuangan/akuntansi/buku-besar?${rangeQuery(range, { account: r.code })}`}
              className="hover:underline"
            >
              {r.name}
            </Link>
          </td>
          <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.opening)}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.debit)}</td>
          <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.credit)}</td>
          <td className="px-4 py-2 text-right tabular-nums font-medium">{formatAccounting(r.closing)}</td>
        </tr>
      ))}
    </>
  );
}
