"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompanySelect } from "@/components/CompanySelect";
import { formatAccounting } from "@/lib/accounting/constants";
import { AccountSelect } from "./AccountSelect";
import { useAccounts } from "./useAccounts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Budgets = Record<string, number[]>;

function splitEven(total: number): number[] {
  const base = Math.floor(total / 12);
  const months = Array(12).fill(base);
  months[11] = total - base * 11;
  return months;
}

export function BudgetManager({ canEdit }: { canEdit: boolean }) {
  const { accounts } = useAccounts();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [company, setCompany] = useState("BCI");
  const [budgets, setBudgets] = useState<Budgets>({});
  const [adding, setAdding] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  const byCode = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);

  useEffect(() => {
    if (!company) return;
    let alive = true;
    setLoading(true);
    setMsg("");
    fetch(`/api/finance/accounting/budgets?year=${year}&company=${encodeURIComponent(company)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setBudgets(d.budgets ?? {});
        setDirty(false);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year, company]);

  const codes = Object.keys(budgets).sort();
  const groups = [
    { key: "REVENUE", label: "Pendapatan", codes: codes.filter((c) => byCode.get(c)?.group === "REVENUE") },
    { key: "EXPENSE", label: "Beban", codes: codes.filter((c) => byCode.get(c)?.group !== "REVENUE") },
  ];

  function update(code: string, months: number[]) {
    setBudgets((b) => ({ ...b, [code]: months }));
    setDirty(true);
  }

  function addAccount(code: string) {
    setAdding("");
    if (!code || budgets[code]) return;
    update(code, Array(12).fill(0));
  }

  function remove(code: string) {
    setBudgets((b) => {
      const next = { ...b };
      delete next[code];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/finance/accounting/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, company, budgets }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(typeof data.error === "string" ? data.error : "Gagal menyimpan");
      return;
    }
    setDirty(false);
    setMsg(`Anggaran ${company} ${year} tersimpan`);
  }

  const monthTotals = Array.from({ length: 12 }, (_, i) =>
    groups.map((g) => g.codes.reduce((s, c) => s + (budgets[c]?.[i] ?? 0), 0))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium text-slate-600">
          Tahun
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
            className="input-field mt-1 w-28"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 min-w-[160px]">
          Perusahaan
          <CompanySelect value={company} onChange={setCompany} className="input-field mt-1" />
        </label>
        {canEdit && (
          <label className="text-xs font-medium text-slate-600 min-w-[280px] flex-1">
            Tambah akun
            <AccountSelect
              value={adding}
              onChange={addAccount}
              groups={["REVENUE", "EXPENSE"]}
              emptyLabel="— pilih akun pendapatan/beban —"
              className="input-field mt-1"
            />
          </label>
        )}
        <div className="ml-auto flex gap-2">
          <Link
            href="/dashboard/keuangan/laporan/anggaran"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Lihat realisasi
          </Link>
          {canEdit && (
            <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary disabled:opacity-50">
              {saving ? "Menyimpan…" : "Simpan anggaran"}
            </button>
          )}
        </div>
      </div>
      {msg && <p className="text-sm text-blue-700">{msg}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-3 w-64">Akun</th>
              <th className="px-2 py-3 text-right w-36">Setahun</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-1 py-3 text-right">{m}</th>
              ))}
              {canEdit && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-slate-400">Memuat…</td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-slate-400">
                  Belum ada anggaran {company} {year}. {canEdit ? "Tambahkan akun di atas." : ""}
                </td>
              </tr>
            ) : (
              groups.map((g, gi) =>
                g.codes.length === 0 ? null : (
                  <GroupRows
                    key={g.key}
                    label={g.label}
                    codes={g.codes}
                    budgets={budgets}
                    names={byCode}
                    canEdit={canEdit}
                    onChange={update}
                    onRemove={remove}
                    monthTotals={monthTotals.map((t) => t[gi])}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <p className="text-xs text-slate-500">
          Isi kolom <strong>Setahun</strong> untuk membagi rata ke 12 bulan, atau isi per bulan bila musiman. Anggaran berlaku per perusahaan.
        </p>
      )}
    </div>
  );
}

function GroupRows({
  label,
  codes,
  budgets,
  names,
  canEdit,
  onChange,
  onRemove,
  monthTotals,
}: {
  label: string;
  codes: string[];
  budgets: Budgets;
  names: Map<string, { name: string }>;
  canEdit: boolean;
  onChange: (code: string, months: number[]) => void;
  onRemove: (code: string) => void;
  monthTotals: number[];
}) {
  const grand = monthTotals.reduce((s, v) => s + v, 0);
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={15} className="px-3 py-2 text-xs font-bold uppercase text-slate-500">{label}</td>
      </tr>
      {codes.map((code) => {
        const months = budgets[code] ?? Array(12).fill(0);
        const total = months.reduce((s, v) => s + v, 0);
        return (
          <tr key={code}>
            <td className="px-3 py-1.5">
              <span className="font-mono text-xs text-slate-500">{code}</span> {names.get(code)?.name ?? ""}
            </td>
            <td className="px-2 py-1.5">
              {canEdit ? (
                <input
                  type="number"
                  min={0}
                  value={total || ""}
                  onChange={(e) => onChange(code, splitEven(Math.max(0, Math.round(Number(e.target.value) || 0))))}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-right tabular-nums"
                />
              ) : (
                <span className="block text-right tabular-nums">{formatAccounting(total)}</span>
              )}
            </td>
            {months.map((v, i) => (
              <td key={i} className="px-1 py-1.5">
                {canEdit ? (
                  <input
                    type="number"
                    min={0}
                    value={v || ""}
                    onChange={(e) => {
                      const next = [...months];
                      next[i] = Math.max(0, Number(e.target.value) || 0);
                      onChange(code, next);
                    }}
                    className="w-full min-w-[80px] rounded border border-slate-200 px-1.5 py-1 text-right text-xs tabular-nums"
                  />
                ) : (
                  <span className="block text-right text-xs tabular-nums">{formatAccounting(v)}</span>
                )}
              </td>
            ))}
            {canEdit && (
              <td className="px-1 text-center">
                <button type="button" onClick={() => onRemove(code)} className="text-red-500 hover:text-red-700" title="Hapus baris">
                  ×
                </button>
              </td>
            )}
          </tr>
        );
      })}
      <tr className="border-t border-slate-200 font-semibold">
        <td className="px-3 py-2">Total {label.toLowerCase()}</td>
        <td className="px-2 py-2 text-right tabular-nums">{formatAccounting(grand)}</td>
        {monthTotals.map((v, i) => (
          <td key={i} className="px-1 py-2 text-right text-xs tabular-nums">{formatAccounting(v)}</td>
        ))}
        {canEdit && <td />}
      </tr>
    </>
  );
}
