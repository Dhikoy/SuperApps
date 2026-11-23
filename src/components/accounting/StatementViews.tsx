"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAccounting } from "@/lib/accounting/constants";
import { defaultRange, rangeQuery, ReportFilterBar, type ReportRange } from "./ReportFilterBar";

type Section = { key: string; label: string; rows: { code: string; name: string; amount: number }[]; total: number };

export function useReport<T>(type: string, query: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/finance/accounting/reports/${type}?${query}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [type, query]);
  return { data, loading };
}

function SectionBlock({ section, ledgerQuery }: { section: Section; ledgerQuery: (code: string) => string }) {
  if (section.rows.length === 0) return null;
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase text-slate-500">{section.label}</td>
      </tr>
      {section.rows.map((r) => (
        <tr key={r.code} className="border-t border-slate-100">
          <td className="px-4 py-2 font-mono w-20">{r.code}</td>
          <td className="px-4 py-2">
            <Link href={`/dashboard/keuangan/akuntansi/buku-besar?${ledgerQuery(r.code)}`} className="hover:underline">
              {r.name}
            </Link>
          </td>
          <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.amount)}</td>
        </tr>
      ))}
      <tr className="border-t border-slate-200 font-semibold">
        <td />
        <td className="px-4 py-2">Total {section.label}</td>
        <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(section.total)}</td>
      </tr>
    </>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={`border-t-2 border-slate-200 ${strong ? "bg-amber-50/60 text-base font-bold" : "font-semibold"}`}>
      <td />
      <td className="px-4 py-3">{label}</td>
      <td className={`px-4 py-3 text-right tabular-nums ${value < 0 ? "text-red-600" : ""}`}>{formatAccounting(value)}</td>
    </tr>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return (
    <tr>
      <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
        {loading ? "Memuat…" : "Belum ada jurnal di periode ini"}
      </td>
    </tr>
  );
}

type ProfitLossData = {
  sections: Section[];
  summary: {
    pendapatanUsaha: number;
    hpp: number;
    labaKotor: number;
    bebanOperasional: number;
    labaUsaha: number;
    pendapatanLuar: number;
    bebanLain: number;
    labaBersih: number;
  };
};

export function ProfitLossView() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const query = rangeQuery(range);
  const { data, loading } = useReport<ProfitLossData>("profit-loss", query);
  const section = (key: string) => data?.sections.find((s) => s.key === key);
  const ledgerQuery = (code: string) => rangeQuery(range, { account: code });
  const hasRows = data?.sections.some((s) => s.rows.length > 0);

  return (
    <div className="space-y-4">
      <ReportFilterBar value={range} onChange={setRange} exportHref={`/api/finance/accounting/reports/profit-loss?${query}&format=xlsx`} />
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <tbody>
            {!data || !hasRows ? (
              <Empty loading={loading} />
            ) : (
              <>
                {["pendapatan-usaha", "hpp"].map((k) => section(k) && <SectionBlock key={k} section={section(k)!} ledgerQuery={ledgerQuery} />)}
                <SummaryRow label="Laba Kotor" value={data.summary.labaKotor} />
                {["beban-sdm", "beban-adm", "beban-pemasaran", "beban-penyusutan"].map(
                  (k) => section(k) && <SectionBlock key={k} section={section(k)!} ledgerQuery={ledgerQuery} />
                )}
                <SummaryRow label="Total Beban Operasional" value={data.summary.bebanOperasional} />
                <SummaryRow label="Laba Usaha" value={data.summary.labaUsaha} />
                {["pendapatan-luar", "beban-lain"].map((k) => section(k) && <SectionBlock key={k} section={section(k)!} ledgerQuery={ledgerQuery} />)}
                <SummaryRow label="LABA (RUGI) BERSIH" value={data.summary.labaBersih} strong />
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type BalanceSheetData = {
  sections: Section[];
  currentEarnings: number;
  totals: { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number };
  balanced: boolean;
};

const ASSET_KEYS = ["aset-lancar", "aset-tetap", "aset-lain"];
const LIABILITY_KEYS = ["kewajiban-pendek", "kewajiban-panjang"];

export function BalanceSheetView() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const query = rangeQuery(range, { asOf: range.to });
  const { data, loading } = useReport<BalanceSheetData>("balance-sheet", query);
  const section = (key: string) => data?.sections.find((s) => s.key === key);
  const ledgerQuery = (code: string) => rangeQuery({ ...range, from: "2000-01-01" }, { account: code });

  return (
    <div className="space-y-4">
      <ReportFilterBar
        value={range}
        onChange={setRange}
        asOfOnly
        exportHref={`/api/finance/accounting/reports/balance-sheet?${query}&format=xlsx`}
      />
      {data && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${data.balanced ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {data.balanced
            ? "Seimbang — Aset = Kewajiban + Ekuitas"
            : `Tidak seimbang — selisih ${formatAccounting(data.totals.assets - data.totals.liabilitiesAndEquity)}`}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3" colSpan={3}>Aset</th>
              </tr>
            </thead>
            <tbody>
              {!data ? <Empty loading={loading} /> : ASSET_KEYS.map((k) => section(k) && <SectionBlock key={k} section={section(k)!} ledgerQuery={ledgerQuery} />)}
              {data && <SummaryRow label="TOTAL ASET" value={data.totals.assets} strong />}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3" colSpan={3}>Kewajiban & Ekuitas</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <Empty loading={loading} />
              ) : (
                <>
                  {LIABILITY_KEYS.map((k) => section(k) && <SectionBlock key={k} section={section(k)!} ledgerQuery={ledgerQuery} />)}
                  <SummaryRow label="Total Kewajiban" value={data.totals.liabilities} />
                  {section("ekuitas") && <SectionBlock section={section("ekuitas")!} ledgerQuery={ledgerQuery} />}
                  <tr className="border-t border-slate-100">
                    <td />
                    <td className="px-4 py-2">Laba (Rugi) Berjalan <span className="text-xs text-slate-400">— belum ditutup ke saldo laba</span></td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(data.currentEarnings)}</td>
                  </tr>
                  <SummaryRow label="Total Ekuitas" value={data.totals.equity} />
                  <SummaryRow label="TOTAL KEWAJIBAN + EKUITAS" value={data.totals.liabilitiesAndEquity} strong />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
