"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanySelect } from "@/components/CompanySelect";
import { DEFAULT_USEFUL_LIFE as DEFAULT_LIFE, DEPRECIATION_MAP, FIXED_ASSET_ACCOUNTS, formatAccounting } from "@/lib/accounting/constants";
import { useAccounts } from "./useAccounts";

type Row = {
  id: string;
  laptop: string;
  serialNumber: string;
  category: string | null;
  quantity: number;
  company: string | null;
  acquisitionCost: number | null;
  acquisitionDate: string | null;
  usefulLifeMonths: number | null;
  residualValue: number;
  assetAccount: string | null;
  configured: boolean;
  depreciable: boolean;
  monthly: number;
  accumulated: number;
  bookValue: number | null;
};

type Schedule = {
  rows: Row[];
  totalMonthly: number;
  posted: { id: string; number: string; company: string; total: number }[];
};

type Draft = {
  company: string;
  assetAccount: string;
  acquisitionCost: string;
  acquisitionDate: string;
  usefulLifeMonths: string;
  residualValue: string;
};

function toDraft(r: Row, fallbackCompany: string): Draft {
  return {
    company: r.company ?? fallbackCompany,
    assetAccount: r.assetAccount ?? "",
    acquisitionCost: r.acquisitionCost ? String(r.acquisitionCost) : "",
    acquisitionDate: r.acquisitionDate
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(r.acquisitionDate))
      : "",
    usefulLifeMonths: r.usefulLifeMonths ? String(r.usefulLifeMonths) : "",
    residualValue: r.residualValue ? String(r.residualValue) : "",
  };
}

export function DepreciationManager({ canEdit }: { canEdit: boolean }) {
  const { accounts } = useAccounts();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [company, setCompany] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Schedule | null>(null);
  const [editing, setEditing] = useState<{ row: Row; draft: Draft } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const accountName = (code: string) => accounts.find((a) => a.code === code)?.name ?? "";

  const load = useCallback(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (company) params.set("company", company);
    fetch(`/api/finance/accounting/depreciation?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [year, month, company]);

  useEffect(() => {
    load();
  }, [load]);

  async function post() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/finance/accounting/depreciation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, company: company || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(typeof body.error === "string" ? body.error : "Gagal posting");
      return;
    }
    const results = (body.results ?? []) as { company: string; total: number; assetCount: number; error?: string }[];
    setMsg(
      results
        .map((r) => (r.error ? `${r.company}: ${r.error}` : `${r.company}: ${formatAccounting(r.total)} (${r.assetCount} aset)`))
        .join(" · ")
    );
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const d = editing.draft;
    const res = await fetch(`/api/finance/accounting/fixed-assets/${editing.row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: d.company,
        assetAccount: d.assetAccount,
        acquisitionCost: Number(d.acquisitionCost) || 0,
        acquisitionDate: d.acquisitionDate,
        usefulLifeMonths: Number(d.usefulLifeMonths) || 0,
        residualValue: Number(d.residualValue) || 0,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(typeof body.error === "string" ? body.error : "Gagal menyimpan");
      return;
    }
    setEditing(null);
    setMsg("Data aset tersimpan. Klik \"Posting penyusutan\" untuk memperbarui jurnal bulan ini.");
    load();
  }

  const q = query.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(
    (r) =>
      (!onlyConfigured || r.configured) &&
      (!q || r.laptop.toLowerCase().includes(q) || r.serialNumber.toLowerCase().includes(q) || (r.category ?? "").toLowerCase().includes(q))
  );
  const configuredCount = (data?.rows ?? []).filter((r) => r.configured).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium text-slate-600">
          Bulan
          <input
            type="month"
            value={`${year}-${String(month).padStart(2, "0")}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              if (y && m) {
                setYear(y);
                setMonth(m);
              }
            }}
            className="input-field mt-1"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 min-w-[160px]">
          Perusahaan
          <CompanySelect value={company} onChange={setCompany} includeAll allLabel="Semua perusahaan" className="input-field mt-1" />
        </label>
        <label className="text-xs font-medium text-slate-600 flex-1 min-w-[200px]">
          Cari aset
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama / serial / kategori" className="input-field mt-1" />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
          <input type="checkbox" checked={onlyConfigured} onChange={(e) => setOnlyConfigured(e.target.checked)} />
          Hanya yang sudah diisi ({configuredCount})
        </label>
        {canEdit && (
          <button type="button" onClick={post} disabled={busy} className="btn-primary ml-auto">
            {busy ? "Memproses…" : "Posting penyusutan"}
          </button>
        )}
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Penyusutan bulan ini (dihitung)</p>
            <p className="text-xl font-bold tabular-nums">{formatAccounting(data.totalMonthly)}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 sm:col-span-2">
            <p className="text-xs text-slate-500">Jurnal penyusutan yang sudah diposting</p>
            {data.posted.length === 0 ? (
              <p className="text-sm text-slate-400 mt-1">Belum diposting — otomatis tiap tanggal 1 untuk bulan sebelumnya, atau klik tombol posting.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {data.posted.map((p) => (
                  <span key={p.id} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {p.company} · {p.number} · {formatAccounting(p.total)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-blue-700">{msg}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Aset</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Akun</th>
              <th className="px-4 py-3 text-right">Harga perolehan</th>
              <th className="px-4 py-3">Perolehan / umur</th>
              <th className="px-4 py-3 text-right">Penyusutan/bln</th>
              <th className="px-4 py-3 text-right">Akumulasi</th>
              <th className="px-4 py-3 text-right">Nilai buku</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Tidak ada aset</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={r.configured ? "" : "text-slate-400"}>
                  <td className="px-4 py-2">
                    <span className={r.configured ? "font-medium text-slate-900" : ""}>{r.laptop}</span>
                    <span className="block text-[11px]">{r.serialNumber}{r.category ? ` · ${r.category}` : ""}</span>
                  </td>
                  <td className="px-4 py-2">{r.company ?? "–"}</td>
                  <td className="px-4 py-2">
                    {r.assetAccount ? (
                      <>
                        <span className="font-mono text-xs">{r.assetAccount}</span> {accountName(r.assetAccount)}
                        {!r.depreciable && <span className="block text-[11px] text-slate-400">tidak disusutkan</span>}
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.acquisitionCost ? formatAccounting(r.acquisitionCost) : "–"}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.acquisitionDate ? new Date(r.acquisitionDate).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "–"}
                    {r.usefulLifeMonths ? ` · ${r.usefulLifeMonths} bln` : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.configured ? formatAccounting(r.monthly) : "–"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.configured ? formatAccounting(r.accumulated) : "–"}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{r.bookValue !== null ? formatAccounting(r.bookValue) : "–"}</td>
                  {canEdit && (
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setEditing({ row: r, draft: toDraft(r, company || "BCI") })}
                        className="text-xs font-semibold text-[#503200] hover:underline"
                      >
                        {r.configured ? "Ubah" : "Isi data"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Metode garis lurus mulai bulan perolehan. Jurnal: Debit beban penyusutan (585–590), Kredit akumulasi penyusutan (142–149, 168–169).
        Perolehan aset sendiri tidak dijurnal di sini — catat lewat pengajuan dana (akun aset) atau saldo awal, termasuk akumulasi penyusutan
        sebelum sistem dipakai.
      </p>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !busy && setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-slate-900">Data aset tetap</h3>
              <p className="text-sm text-slate-500">{editing.row.laptop} · {editing.row.serialNumber}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Perusahaan pemilik
                <CompanySelect
                  value={editing.draft.company}
                  onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, company: v } })}
                  className="input-field mt-1"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Akun aset
                <select
                  value={editing.draft.assetAccount}
                  onChange={(e) => {
                    const code = e.target.value;
                    setEditing({
                      ...editing,
                      draft: {
                        ...editing.draft,
                        assetAccount: code,
                        usefulLifeMonths: editing.draft.usefulLifeMonths || (DEFAULT_LIFE[code] ? String(DEFAULT_LIFE[code]) : ""),
                      },
                    });
                  }}
                  className="input-field mt-1"
                >
                  <option value="">— pilih —</option>
                  {FIXED_ASSET_ACCOUNTS.map((code) => (
                    <option key={code} value={code}>
                      {code} {accountName(code)}{DEPRECIATION_MAP[code] ? "" : " (tidak disusutkan)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Harga perolehan (total)
                <input
                  type="number"
                  min={0}
                  value={editing.draft.acquisitionCost}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, acquisitionCost: e.target.value } })}
                  className="input-field mt-1"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Tanggal perolehan
                <input
                  type="date"
                  value={editing.draft.acquisitionDate}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, acquisitionDate: e.target.value } })}
                  className="input-field mt-1"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Umur ekonomis (bulan)
                <input
                  type="number"
                  min={1}
                  value={editing.draft.usefulLifeMonths}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, usefulLifeMonths: e.target.value } })}
                  className="input-field mt-1"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Nilai sisa (opsional)
                <input
                  type="number"
                  min={0}
                  value={editing.draft.residualValue}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, residualValue: e.target.value } })}
                  className="input-field mt-1"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Umur default mengikuti kelompok harta pajak (komputer/peralatan kantor 4 th, kendaraan/mesin 8 th, bangunan 20 th). Kosongkan
              akun & harga lalu simpan untuk mengeluarkan aset dari daftar penyusutan.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
                Batal
              </button>
              <button type="button" onClick={saveEdit} disabled={busy} className="btn-primary">
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
