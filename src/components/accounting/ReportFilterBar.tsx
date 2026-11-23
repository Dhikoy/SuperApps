"use client";

import { CompanySelect } from "@/components/CompanySelect";
import { getPeriodForDate, getPeriodRange } from "@/lib/period";

export type ReportRange = { from: string; to: string; company: string };

export function ymdJakarta(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
}

export function defaultRange(): ReportRange {
  const today = ymdJakarta(new Date());
  return { from: `${today.slice(0, 8)}01`, to: today, company: "" };
}

function presets() {
  const now = new Date();
  const today = ymdJakarta(now);
  const { year, month } = getPeriodForDate(now);
  const cutoff = getPeriodRange(year, month);
  return [
    { label: "Bulan ini", from: `${today.slice(0, 8)}01`, to: today },
    { label: "Periode 26–25", from: ymdJakarta(cutoff.start), to: ymdJakarta(cutoff.end) },
    { label: "Tahun ini", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

export function rangeQuery(range: ReportRange, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ from: range.from, to: range.to, ...extra });
  if (range.company) params.set("company", range.company);
  return params.toString();
}

type Props = {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
  /** Neraca: satu tanggal (pakai `to`) */
  asOfOnly?: boolean;
  exportHref?: string;
  children?: React.ReactNode;
};

export function ReportFilterBar({ value, onChange, asOfOnly, exportHref, children }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        {!asOfOnly && (
          <label className="text-xs font-medium text-slate-600">
            Dari
            <input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="input-field mt-1"
            />
          </label>
        )}
        <label className="text-xs font-medium text-slate-600">
          {asOfOnly ? "Per tanggal" : "Sampai"}
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="input-field mt-1"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 min-w-[160px]">
          Perusahaan
          <CompanySelect
            value={value.company}
            onChange={(company) => onChange({ ...value, company })}
            includeAll
            allLabel="Semua perusahaan"
            className="input-field mt-1"
          />
        </label>
        {children}
        <div className="ml-auto flex flex-wrap gap-2">
          {exportHref && (
            <a href={exportHref} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              Export XLSX
            </a>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cetak
          </button>
        </div>
      </div>
      {!asOfOnly && (
        <div className="flex flex-wrap gap-2">
          {presets().map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ ...value, from: p.from, to: p.to })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                value.from === p.from && value.to === p.to
                  ? "bg-[#503200] text-white ring-[#503200]"
                  : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
