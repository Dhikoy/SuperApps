"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRupiah } from "@/lib/payroll-policy";
import { MONTHS_ID } from "@/lib/period";
import { AccountSelect } from "@/components/accounting/AccountSelect";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";
import { PosSalesPanel } from "@/components/pos/PosSalesPanel";

type PosTx = {
  id: string;
  company: string;
  outlet: string | null;
  type: string;
  amount: number;
  description: string | null;
  transactionDate: string;
  externalRef: string | null;
  accountCode: string | null;
  cashAccount: string | null;
};

type PosData = { transactions: PosTx[]; sales: number; expenses: number; profit: number; outlets: string[] };

type OutletStatus = {
  outlet: string;
  company: string;
  host: string;
  lastSync: { status: string; message: string | null; createdAt: string } | null;
  lastPushAt: string | null;
};

const defaultAccountFor = (type: string): string =>
  type === "SALE" ? DEFAULT_ACCOUNTS.posIncome : DEFAULT_ACCOUNTS.posExpense;

function emptyForm() {
  return {
    type: "SALE",
    amount: "",
    description: "",
    transactionDate: new Date().toISOString().slice(0, 10),
    externalRef: "",
    accountCode: defaultAccountFor("SALE"),
    cashAccount: DEFAULT_ACCOUNTS.pettyCash as string,
  };
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PosPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [outlet, setOutlet] = useState("");
  const [data, setData] = useState<PosData | null>(null);
  const [outletStatus, setOutletStatus] = useState<OutletStatus[]>([]);
  const [syncDays, setSyncDays] = useState(3);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"sales" | "recap">("sales");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    if (outlet) qs.set("outlet", outlet);
    fetch(`/api/integrations/pos?${qs}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [year, month, outlet]);

  const loadStatus = useCallback(() => {
    fetch("/api/integrations/pos/sync")
      .then((r) => r.json())
      .then((d) => setOutletStatus(d.outlets ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleSync(target?: string) {
    setSyncing(true);
    setSyncMessage("");
    const res = await fetch("/api/integrations/pos/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: syncDays, outlet: target }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSyncMessage(typeof body.error === "string" ? body.error : "Sync gagal");
    } else {
      const parts = (body.results ?? []).map(
        (r: { outlet: string; ok: boolean; sales: number; changedSales: number; voided: number; errors: string[] }) =>
          r.ok
            ? `${r.outlet}: ${r.sales} struk, ${r.changedSales} baru/berubah${r.voided ? `, ${r.voided} void` : ""}`
            : `${r.outlet}: gagal — ${r.errors[0] ?? "tidak diketahui"}`
      );
      setSyncMessage(parts.join(" · "));
    }
    setSyncing(false);
    loadStatus();
    load();
    setRefreshKey((k) => k + 1);
  }

  function startEdit(t: PosTx) {
    setEditingId(t.id);
    setShowForm(true);
    setForm({
      type: t.type,
      amount: String(t.amount),
      description: t.description ?? "",
      transactionDate: toDateInput(t.transactionDate),
      externalRef: t.externalRef ?? "",
      accountCode: t.accountCode ?? defaultAccountFor(t.type),
      cashAccount: t.cashAccount ?? DEFAULT_ACCOUNTS.pettyCash,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const common = {
      type: form.type,
      amount: Number(form.amount),
      description: form.description,
      transactionDate: form.transactionDate,
      accountCode: form.accountCode,
      cashAccount: form.cashAccount,
    };
    const res = await fetch("/api/integrations/pos", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingId
          ? { id: editingId, ...common }
          : { company: "LBB", ...common, externalRef: form.externalRef || undefined }
      ),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Gagal menyimpan");
      setLoading(false);
      return;
    }
    setEditingId(null);
    setForm(emptyForm());
    load();
    setLoading(false);
  }

  async function handleDelete(t: PosTx) {
    const note = t.outlet ? "\n\nData dari sync POS akan muncul lagi saat sync berikutnya jika masih ada di POS." : "";
    if (!confirm(`Hapus transaksi POS ini? Pendapatan & jurnalnya ikut terhapus.${note}`)) return;
    const res = await fetch(`/api/integrations/pos?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Gagal menghapus");
      return;
    }
    if (editingId === t.id) setEditingId(null);
    load();
  }

  const outletChips = Array.from(new Set([...outletStatus.map((o) => o.outlet), ...(data?.outlets ?? [])])).sort();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">POS Outlet LBB</h1>
        <p className="text-slate-500 text-sm mt-1">
          Pendapatan harian outlet ditarik otomatis dari aplikasi POS dan langsung tercatat di pendapatan &amp; jurnal.
        </p>
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Sinkronisasi POS</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={syncDays} onChange={(e) => setSyncDays(Number(e.target.value))} className="input-field !w-auto">
              <option value={3}>3 hari terakhir</option>
              <option value={7}>7 hari terakhir</option>
              <option value={31}>31 hari terakhir</option>
              <option value={90}>90 hari terakhir</option>
              <option value={365}>365 hari terakhir</option>
            </select>
            <button
              type="button"
              onClick={() => handleSync()}
              disabled={syncing || outletStatus.length === 0}
              className="btn-primary"
            >
              {syncing ? "Menarik data..." : "Sync sekarang"}
            </button>
          </div>
        </div>

        {outletStatus.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            Belum ada outlet POS yang terhubung. Hubungi admin sistem untuk mengisi akun POS outlet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {outletStatus.map((o) => (
              <div key={o.outlet} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {o.outlet} <span className="font-normal text-slate-400">· {o.company}</span>
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      !o.lastSync
                        ? "bg-slate-100 text-slate-500"
                        : o.lastSync.status === "SUCCESS"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {!o.lastSync ? "Belum pernah" : o.lastSync.status === "SUCCESS" ? "OK" : "Gagal"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{o.host}</p>
                {o.lastSync && (
                  <p className="text-xs text-slate-600 mt-2">
                    Tarik: {new Date(o.lastSync.createdAt).toLocaleString("id-ID")} — {o.lastSync.message}
                  </p>
                )}
                <p className="text-xs text-slate-600 mt-1">
                  Kiriman POS terakhir: {o.lastPushAt ? new Date(o.lastPushAt).toLocaleString("id-ID") : "belum ada"}
                </p>
              </div>
            ))}
          </div>
        )}
        {syncMessage && <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{syncMessage}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["", ...outletChips, "MANUAL"].map((o) => (
          <button
            key={o || "ALL"}
            type="button"
            onClick={() => setOutlet(o)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              outlet === o ? "bg-[#503200] text-white ring-[#503200]" : "bg-white text-[#4a3d2e] ring-[#e8dfd0] hover:bg-[#fdf6e8]"
            }`}
          >
            {o === "" ? "Semua" : o === "MANUAL" ? "Input manual" : o}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input-field !w-auto">
            {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input-field !w-auto">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="inline-flex rounded-xl bg-[#fdf6e8] p-1 ring-1 ring-[#e8dfd0]">
        {[
          { id: "sales", label: "Per struk" },
          { id: "recap", label: "Rekap harian (jurnal)" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id as "sales" | "recap")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              view === tab.id ? "bg-white text-[#503200] shadow-sm" : "text-[#7a4f00] hover:text-[#503200]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "sales" && <PosSalesPanel outlet={outlet} year={year} month={month} refreshKey={refreshKey} />}

      {view === "recap" && (<>
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border p-4">
            <p className="text-xs text-slate-500">Penjualan</p>
            <p className="text-lg font-bold text-emerald-600">{formatRupiah(data.sales)}</p>
          </div>
          <div className="rounded-xl bg-white border p-4">
            <p className="text-xs text-slate-500">Pengeluaran POS</p>
            <p className="text-lg font-bold text-red-600">{formatRupiah(data.expenses)}</p>
          </div>
          <div className="rounded-xl bg-white border p-4">
            <p className="text-xs text-slate-500">Laba POS</p>
            <p className="text-lg font-bold text-blue-600">{formatRupiah(data.profit)}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-between font-semibold"
        >
          {editingId ? "Edit transaksi POS" : "Input manual"}
          <span className="text-xs text-slate-400">{showForm ? "Tutup" : "Buka"}</span>
        </button>
        {showForm && (
          <form onSubmit={handleImport} className="space-y-3">
            {editingId && (
              <button
                type="button"
                className="text-sm font-semibold text-[#503200] underline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
              >
                Batal edit
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value, accountCode: defaultAccountFor(e.target.value) })}
                className="input-field"
              >
                <option value="SALE">Penjualan</option>
                <option value="EXPENSE">Pengeluaran</option>
              </select>
              <input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} className="input-field" required />
            </div>
            <input type="number" placeholder="Nominal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" required />
            <input placeholder="Keterangan" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                {form.type === "SALE" ? "Akun pendapatan" : "Akun beban"}
                <AccountSelect
                  value={form.accountCode}
                  onChange={(accountCode) => setForm({ ...form, accountCode })}
                  groups={form.type === "SALE" ? ["REVENUE"] : ["EXPENSE", "ASSET"]}
                  className="input-field mt-1"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                {form.type === "SALE" ? "Masuk ke (Kas/Bank)" : "Dibayar dari (Kas/Bank)"}
                <AccountSelect value={form.cashAccount} onChange={(cashAccount) => setForm({ ...form, cashAccount })} cashOnly className="input-field mt-1" />
              </label>
            </div>
            {!editingId && (
              <input placeholder="External ref (opsional, anti duplikat)" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} className="input-field" />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">{loading ? "..." : editingId ? "Simpan Perubahan" : "Simpan"}</button>
          </form>
        )}
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.transactions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Belum ada data di periode ini</td></tr>
            )}
            {data?.transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(t.transactionDate).toLocaleDateString("id-ID")}</td>
                <td className="px-4 py-3">
                  {t.outlet ?? <span className="text-slate-400">Manual</span>}
                </td>
                <td className="px-4 py-3">
                  {t.type === "SALE" ? "Penjualan" : "Pengeluaran"}
                  <span className="block text-[11px] text-slate-400">akun {t.accountCode ?? defaultAccountFor(t.type)}</span>
                </td>
                <td className="px-4 py-3">{t.description ?? "-"}</td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatRupiah(t.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {t.outlet ? (
                      <span className="text-[11px] text-slate-400">Otomatis dari POS</span>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(t)} className="text-xs font-semibold text-[#503200] hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(t)} className="text-xs font-semibold text-red-600 hover:underline">
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}
