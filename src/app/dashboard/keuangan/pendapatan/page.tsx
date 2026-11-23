"use client";

import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/ui";
import { CompanySelect } from "@/components/CompanySelect";
import { formatRupiah } from "@/lib/payroll-policy";
import { AccountSelect } from "@/components/accounting/AccountSelect";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";

function incomeDefaultsFor(source: string) {
  return source === "POS"
    ? { cash: DEFAULT_ACCOUNTS.pettyCash, income: DEFAULT_ACCOUNTS.posIncome }
    : { cash: DEFAULT_ACCOUNTS.cash, income: DEFAULT_ACCOUNTS.income };
}

type Income = {
  id: string;
  title: string;
  company: string;
  amount: number;
  source: string;
  entryDate: string;
  remarks: string | null;
  accountCode: string | null;
  cashAccount: string | null;
  posTransactionId: string | null;
};

export default function PendapatanPage() {
  const empty = {
    title: "",
    company: "LBB",
    amount: "",
    entryDate: "",
    remarks: "",
    accountCode: DEFAULT_ACCOUNTS.income as string,
    cashAccount: DEFAULT_ACCOUNTS.cash as string,
  };
  const [form, setForm] = useState(empty);
  const [entries, setEntries] = useState<Income[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    fetch("/api/finance/income").then((r) => r.json()).then(setEntries).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  function toDateInput(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function startEdit(e: Income) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      company: e.company,
      amount: String(e.amount),
      entryDate: toDateInput(e.entryDate),
      remarks: e.remarks ?? "",
      accountCode: e.accountCode ?? incomeDefaultsFor(e.source).income,
      cashAccount: e.cashAccount ?? incomeDefaultsFor(e.source).cash,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/finance/income", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingId ? { id: editingId } : {}),
        ...form,
        amount: Number(form.amount),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Gagal menyimpan");
      setLoading(false);
      return;
    }

    setEditingId(null);
    setForm(empty);
    load();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus pendapatan ini?")) return;
    const res = await fetch(`/api/finance/income?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Gagal menghapus");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setForm(empty);
    }
    load();
  }

  return (
    <div className="max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Form Pendapatan</h1>
        <p className="text-slate-500 mt-1 text-sm">Setiap pendapatan otomatis dijurnal: Debit Kas/Bank, Kredit akun pendapatan</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
        {editingId && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>Mode edit pendapatan</span>
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
              }}
            >
              Batal
            </button>
          </div>
        )}
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT_CLASS} placeholder="Judul pendapatan" required />
        <CompanySelect value={form.company} onChange={(company) => setForm({ ...form, company })} />
        <input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={INPUT_CLASS} placeholder="Nominal (Rp)" required />
        <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} className={INPUT_CLASS} required />
        <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={INPUT_CLASS} placeholder="Keterangan (opsional)" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            Akun pendapatan
            <AccountSelect value={form.accountCode} onChange={(accountCode) => setForm({ ...form, accountCode })} groups={["REVENUE"]} className="input-field mt-1" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Masuk ke (Kas/Bank)
            <AccountSelect value={form.cashAccount} onChange={(cashAccount) => setForm({ ...form, cashAccount })} cashOnly className="input-field mt-1" />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "..." : editingId ? "Simpan Perubahan" : "Simpan Pendapatan"}</button>
      </form>

      <div className="rounded-xl border border-slate-200 overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Judul</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Sumber</th>
              <th className="px-4 py-3">Nominal</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">{new Date(e.entryDate).toLocaleDateString("id-ID")}</td>
                <td className="px-4 py-3">{e.title}</td>
                <td className="px-4 py-3">{e.company}</td>
                <td className="px-4 py-3">
                  {e.source}
                  <span className="block text-[11px] text-slate-400">
                    {e.cashAccount ?? incomeDefaultsFor(e.source).cash} ← {e.accountCode ?? incomeDefaultsFor(e.source).income}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{formatRupiah(e.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {e.posTransactionId ? (
                      <span className="text-xs text-slate-400">Ubah di menu POS</span>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(e)} className="text-xs font-semibold text-[#503200] hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(e.id)} className="text-xs font-semibold text-red-600 hover:underline">
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
    </div>
  );
}
