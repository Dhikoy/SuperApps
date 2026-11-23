"use client";

import Link from "next/link";
import { useState } from "react";
import { formatAccounting } from "@/lib/accounting/constants";
import { defaultRange, rangeQuery, ReportFilterBar, type ReportRange } from "./ReportFilterBar";
import { useReport } from "./StatementViews";

const AGING_BUCKETS = [
  { key: "current", label: "Belum jatuh tempo" },
  { key: "d30", label: "1–30 hari" },
  { key: "d60", label: "31–60 hari" },
  { key: "d90", label: "61–90 hari" },
  { key: "over90", label: "> 90 hari" },
] as const;

type BucketKey = (typeof AGING_BUCKETS)[number]["key"];

type AgingData = {
  rows: {
    id: string;
    invoiceNumber: string;
    company: string;
    customer: string;
    issueDate: string;
    dueDate: string;
    defaultTerm: boolean;
    daysOverdue: number;
    amount: number;
    bucket: BucketKey;
  }[];
  totals: Record<BucketKey, number>;
  total: number;
  ledgerBalance: number;
  customers: { customer: string; total: number; count: number }[];
};

const BUCKET_TONE: Record<BucketKey, string> = {
  current: "bg-emerald-50 text-emerald-700",
  d30: "bg-amber-50 text-amber-700",
  d60: "bg-orange-50 text-orange-700",
  d90: "bg-red-50 text-red-700",
  over90: "bg-red-100 text-red-800",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
}

export function AgingView() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const query = rangeQuery(range, { asOf: range.to });
  const { data, loading } = useReport<AgingData>("aging", query);
  const labels = new Map(AGING_BUCKETS.map((b) => [b.key, b.label]));
  const mismatch = data ? Math.abs(data.total - data.ledgerBalance) >= 0.01 : false;

  return (
    <div className="space-y-4">
      <ReportFilterBar value={range} onChange={setRange} asOfOnly exportHref={`/api/finance/accounting/reports/aging?${query}&format=xlsx`} />

      {data && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {AGING_BUCKETS.map((b) => (
            <div key={b.key} className={`rounded-xl p-3 ${BUCKET_TONE[b.key]}`}>
              <p className="text-xs font-medium">{b.label}</p>
              <p className="text-lg font-bold tabular-nums">{formatAccounting(data.totals[b.key])}</p>
            </div>
          ))}
          <div className="rounded-xl bg-slate-900 p-3 text-white">
            <p className="text-xs font-medium text-slate-300">Total piutang</p>
            <p className="text-lg font-bold tabular-nums">{formatAccounting(data.total)}</p>
          </div>
        </div>
      )}

      {data && mismatch && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Saldo akun 110 Piutang Usaha di jurnal {formatAccounting(data.ledgerBalance)} berbeda dari total invoice belum lunas — ada
          jurnal manual / saldo awal piutang di luar invoice.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Klien</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Jatuh tempo</th>
              <th className="px-4 py-3 text-right">Telat</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3">Umur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data || data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {loading ? "Memuat…" : "Tidak ada piutang terbuka"}
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{r.invoiceNumber}</span>
                    <span className="block text-[11px] text-slate-400">{r.company}</span>
                  </td>
                  <td className="px-4 py-2">{r.customer}</td>
                  <td className="px-4 py-2">{fmtDate(r.issueDate)}</td>
                  <td className="px-4 py-2">
                    {fmtDate(r.dueDate)}
                    {r.defaultTerm && <span className="block text-[11px] text-slate-400">default 30 hari</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.daysOverdue > 0 ? `${r.daysOverdue} hari` : "–"}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatAccounting(r.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BUCKET_TONE[r.bucket]}`}>{labels.get(r.bucket)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.customers.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Piutang per klien</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.customers.map((c) => (
              <div key={c.customer} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {c.customer} <span className="text-xs text-slate-400">({c.count} invoice)</span>
                </span>
                <span className="font-semibold tabular-nums">{formatAccounting(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type CashFlowData = {
  sections: {
    key: string;
    label: string;
    rows: { code: string; name: string; amount: number }[];
    inflow: number;
    outflow: number;
    net: number;
  }[];
  opening: number;
  netChange: number;
  closing: number;
  reconciled: boolean;
};

export function CashFlowView() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const query = rangeQuery(range);
  const { data, loading } = useReport<CashFlowData>("cash-flow", query);
  const ledgerQuery = (code: string) => rangeQuery(range, { account: code });

  return (
    <div className="space-y-4">
      <ReportFilterBar value={range} onChange={setRange} exportHref={`/api/finance/accounting/reports/cash-flow?${query}&format=xlsx`} />
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <tbody>
            {!data ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">{loading ? "Memuat…" : "Tidak ada data"}</td>
              </tr>
            ) : (
              <>
                <tr className="font-semibold">
                  <td className="w-20" />
                  <td className="px-4 py-3">Saldo kas & bank awal</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAccounting(data.opening)}</td>
                </tr>
                {data.sections.map((s) => (
                  <SectionRows key={s.key} section={s} ledgerQuery={ledgerQuery} />
                ))}
                <tr className="border-t-2 border-slate-200 font-semibold">
                  <td />
                  <td className="px-4 py-3">Kenaikan (penurunan) kas bersih</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${data.netChange < 0 ? "text-red-600" : ""}`}>
                    {formatAccounting(data.netChange)}
                  </td>
                </tr>
                <tr className="border-t-2 border-slate-200 bg-amber-50/60 text-base font-bold">
                  <td />
                  <td className="px-4 py-3">Saldo kas & bank akhir</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAccounting(data.closing)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      {data && !data.reconciled && (
        <p className="text-sm text-red-600">Saldo awal + arus kas tidak sama dengan saldo akhir — cek jurnal transfer antar kas.</p>
      )}
    </div>
  );
}

function SectionRows({
  section,
  ledgerQuery,
}: {
  section: CashFlowData["sections"][number];
  ledgerQuery: (code: string) => string;
}) {
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase text-slate-500">{section.label}</td>
      </tr>
      {section.rows.length === 0 ? (
        <tr>
          <td />
          <td colSpan={2} className="px-4 py-2 text-slate-400">Tidak ada transaksi</td>
        </tr>
      ) : (
        section.rows.map((r) => (
          <tr key={r.code} className="border-t border-slate-100">
            <td className="px-4 py-2 font-mono">{r.code}</td>
            <td className="px-4 py-2">
              <Link href={`/dashboard/keuangan/akuntansi/buku-besar?${ledgerQuery(r.code)}`} className="hover:underline">
                {r.amount >= 0 ? "Penerimaan" : "Pengeluaran"} — {r.name}
              </Link>
            </td>
            <td className={`px-4 py-2 text-right tabular-nums ${r.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {formatAccounting(r.amount)}
            </td>
          </tr>
        ))
      )}
      <tr className="border-t border-slate-200 font-semibold">
        <td />
        <td className="px-4 py-2">Kas bersih dari {section.label.toLowerCase()}</td>
        <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(section.net)}</td>
      </tr>
    </>
  );
}

type BudgetBlock = {
  rows: { code: string; name: string; budget: number; actual: number; variance: number; pct: number | null }[];
  budget: number;
  actual: number;
  variance: number;
  pct: number | null;
};

type BudgetData = { months: number; revenue: BudgetBlock; expense: BudgetBlock; net: { budget: number; actual: number } };

export function BudgetView() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const query = rangeQuery(range);
  const { data, loading } = useReport<BudgetData>("budget", query);

  return (
    <div className="space-y-4">
      <ReportFilterBar value={range} onChange={setRange} exportHref={`/api/finance/accounting/reports/budget?${query}&format=xlsx`}>
        <Link
          href="/dashboard/keuangan/akuntansi/anggaran"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Atur anggaran
        </Link>
      </ReportFilterBar>
      {data && (
        <p className="text-xs text-slate-500">
          Anggaran dijumlah dari {data.months} bulan yang tercakup periode. Selisih positif = baik (pendapatan di atas target / beban di bawah
          anggaran).
        </p>
      )}
      {!data ? (
        <p className="text-sm text-slate-400">{loading ? "Memuat…" : "Tidak ada data"}</p>
      ) : (
        <>
          <BudgetTable title="Pendapatan" block={data.revenue} expense={false} />
          <BudgetTable title="Beban" block={data.expense} expense />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Laba bersih — anggaran</p>
              <p className="text-xl font-bold tabular-nums">{formatAccounting(data.net.budget)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-slate-500">Laba bersih — realisasi</p>
              <p className={`text-xl font-bold tabular-nums ${data.net.actual < 0 ? "text-red-600" : ""}`}>{formatAccounting(data.net.actual)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BudgetTable({ title, block, expense }: { title: string; block: BudgetBlock; expense: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-3" colSpan={2}>{title}</th>
            <th className="px-4 py-3 text-right">Anggaran</th>
            <th className="px-4 py-3 text-right">Realisasi</th>
            <th className="px-4 py-3 text-right">Selisih</th>
            <th className="px-4 py-3 w-44">Pemakaian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {block.rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Belum ada anggaran / transaksi</td>
            </tr>
          ) : (
            block.rows.map((r) => {
              const over = expense ? r.pct !== null && r.pct > 100 : r.pct !== null && r.pct < 100;
              return (
                <tr key={r.code}>
                  <td className="px-4 py-2 font-mono w-16">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.budget)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(r.actual)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${r.variance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {formatAccounting(r.variance)}
                  </td>
                  <td className="px-4 py-2">
                    {r.pct === null ? (
                      <span className="text-xs text-slate-400">tanpa anggaran</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full ${over ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, Math.max(0, r.pct))}%` }}
                          />
                        </div>
                        <span className={`text-xs tabular-nums ${over ? "text-red-600" : "text-slate-600"}`}>{r.pct}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
          <tr className="border-t-2 border-slate-200 font-semibold">
            <td />
            <td className="px-4 py-2">Total {title.toLowerCase()}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(block.budget)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(block.actual)}</td>
            <td className={`px-4 py-2 text-right tabular-nums ${block.variance < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {formatAccounting(block.variance)}
            </td>
            <td className="px-4 py-2 text-xs text-slate-500">{block.pct === null ? "" : `${block.pct}%`}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
