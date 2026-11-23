"use client";

import { useEffect, useState } from "react";
import { MONTHS_ID } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";
import { CompanySelect } from "@/components/CompanySelect";

export default function CashFlowPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [company, setCompany] = useState("");
  const [data, setData] = useState<{
    periodLabel: string;
    summary: {
      totalIncome: number;
      totalExpense: number;
      netCashFlow: number;
      incomeBreakdown: { source: string; amount: number }[];
      expenseBreakdown: { category: string; amount: number }[];
      posProfit?: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (company) params.set("company", company);
    fetch(`/api/finance/cashflow?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, month, company]);

  const summary = data?.summary;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Laporan Cash Flow</h1>
        <p className="text-slate-500 mt-1 text-sm">Periode cut-off 26 s/d 25 — pendapatan vs pengeluaran terealisasi</p>
        {data?.periodLabel && <p className="text-sm text-orange-600 mt-1 font-medium">{data.periodLabel}</p>}
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl bg-white p-4 border border-slate-100">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm">
          {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm">
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <CompanySelect
          value={company}
          onChange={setCompany}
          className="rounded-lg border px-3 py-2 text-sm"
          includeAll
        />
        <button
          onClick={() => window.open(`/api/finance/cashflow?year=${year}&month=${month}${company ? `&company=${company}` : ""}&format=pdf`, "_blank")}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Export PDF
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Memuat...</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white p-5 border border-slate-100">
              <p className="text-xs text-slate-500">Total Pendapatan</p>
              <p className="text-xl font-bold text-emerald-600">{formatRupiah(summary.totalIncome)}</p>
            </div>
            <div className="rounded-xl bg-white p-5 border border-slate-100">
              <p className="text-xs text-slate-500">Total Pengeluaran</p>
              <p className="text-xl font-bold text-red-600">{formatRupiah(summary.totalExpense)}</p>
            </div>
            <div className="rounded-xl bg-white p-5 border border-slate-100">
              <p className="text-xs text-slate-500">Net Cash Flow</p>
              <p className={`text-xl font-bold ${summary.netCashFlow >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {formatRupiah(summary.netCashFlow)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 border border-slate-100">
              <p className="text-xs text-slate-500">Laba POS</p>
              <p className="text-xl font-bold text-purple-600">{formatRupiah(summary.posProfit ?? 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white p-5 border border-slate-100">
              <h3 className="font-semibold mb-3">Pendapatan per Sumber</h3>
              {summary.incomeBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada data</p>
              ) : (
                summary.incomeBreakdown.map((row) => (
                  <p key={row.source} className="text-sm flex justify-between py-1">
                    <span>{row.source}</span>
                    <span className="font-medium">{formatRupiah(row.amount)}</span>
                  </p>
                ))
              )}
            </div>
            <div className="rounded-xl bg-white p-5 border border-slate-100">
              <h3 className="font-semibold mb-3">Pengeluaran per Kategori</h3>
              {summary.expenseBreakdown.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada data</p>
              ) : (
                summary.expenseBreakdown.map((row) => (
                  <p key={row.category} className="text-sm flex justify-between py-1">
                    <span>{row.category}</span>
                    <span className="font-medium">{formatRupiah(row.amount)}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
