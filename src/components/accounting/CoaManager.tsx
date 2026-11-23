"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { ACCOUNT_GROUP_LABELS, REPORT_SECTIONS, sectionForCode, type AccountGroupKey } from "@/lib/accounting/constants";
import { useAccounts, type AccountOption } from "./useAccounts";

const EMPTY_FORM = { code: "", name: "", isHeader: false, isCash: false };

export function CoaManager({ canManage }: { canManage: boolean }) {
  const { accounts, loading, reload } = useAccounts();
  const { showToast } = useToast();
  const [group, setGroup] = useState<AccountGroupKey | "">("");
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<{ code: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const needle = q.trim().toLowerCase();
  const filtered = accounts.filter(
    (a) =>
      (!group || a.group === group) &&
      (showInactive || a.active) &&
      (!needle || a.code.includes(needle) || a.name.toLowerCase().includes(needle))
  );

  async function call(url: string, init: RequestInit, okMessage: string) {
    setBusy(true);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showToast(data.error ?? "Gagal menyimpan", "error");
      return false;
    }
    showToast(okMessage, "success");
    reload();
    return true;
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/finance/accounting/accounts", { method: "POST", body: JSON.stringify(form) }, "Akun ditambahkan")) {
      setForm(EMPTY_FORM);
    }
  }

  function patch(a: AccountOption, data: Record<string, unknown>, message: string) {
    return call(`/api/finance/accounting/accounts/${a.code}`, { method: "PATCH", body: JSON.stringify(data) }, message);
  }

  async function remove(a: AccountOption) {
    if (!confirm(`Hapus akun ${a.code} ${a.name}?`)) return;
    await call(`/api/finance/accounting/accounts/${a.code}`, { method: "DELETE" }, "Akun dihapus");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(ACCOUNT_GROUP_LABELS) as AccountGroupKey[]).map((g) => {
          const range = REPORT_SECTIONS.filter((s) => s.group === g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(group === g ? "" : g)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                group === g ? "border-[#503200] bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{ACCOUNT_GROUP_LABELS[g]}</p>
              <p className="text-xs text-slate-500">
                {range[0]?.from}–{range[range.length - 1]?.to} · {accounts.filter((a) => a.group === g && !a.isHeader).length} akun
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / nama akun" className="input-field max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Tampilkan nonaktif
        </label>
      </div>

      {canManage && (
        <form onSubmit={addAccount} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="text-xs font-medium text-slate-600">
            Kode
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })}
              placeholder="mis. 428"
              className="input-field mt-1 w-28"
              required
            />
          </label>
          <label className="text-xs font-medium text-slate-600 flex-1 min-w-[200px]">
            Nama akun
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field mt-1" required />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
            <input type="checkbox" checked={form.isHeader} onChange={(e) => setForm({ ...form, isHeader: e.target.checked })} />
            Akun induk
          </label>
          {form.code.startsWith("1") && (
            <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
              <input type="checkbox" checked={form.isCash} onChange={(e) => setForm({ ...form, isCash: e.target.checked })} />
              Kas/Bank
            </label>
          )}
          <button type="submit" disabled={busy} className="btn-primary">+ Tambah akun</button>
          <p className="w-full text-xs text-slate-500">
            Digit pertama menentukan kelompok: 1 Aset · 2 Kewajiban · 3 Ekuitas · 4 Pendapatan · 5 Beban.
          </p>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3">Kelompok / Bagian</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Saldo Normal</th>
              <th className="px-4 py-3 text-right">Dipakai</th>
              {canManage && <th className="px-4 py-3">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Memuat…</td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr
                key={a.code}
                className={`border-t border-slate-100 ${a.isHeader ? "bg-slate-50 font-semibold" : ""} ${a.active ? "" : "opacity-50"}`}
              >
                <td className="px-4 py-2 font-mono">{a.code}</td>
                <td className="px-4 py-2">
                  {editing?.code === a.code ? (
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await patch(a, { name: editing.name }, "Nama akun diperbarui")) setEditing(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="input-field py-1"
                      />
                      <button type="submit" className="text-xs font-semibold text-emerald-700">Simpan</button>
                      <button type="button" onClick={() => setEditing(null)} className="text-xs text-slate-500">Batal</button>
                    </form>
                  ) : (
                    a.name
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {ACCOUNT_GROUP_LABELS[a.group]}
                  {sectionForCode(a.code) ? ` · ${sectionForCode(a.code)!.label}` : ""}
                </td>
                <td className="px-4 py-2">
                  {a.isHeader ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px]">Induk</span>
                  ) : a.isCash ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800">Kas/Bank</span>
                  ) : (
                    <span className="text-xs text-slate-400">Detail</span>
                  )}
                  {!a.active && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">Nonaktif</span>}
                </td>
                <td className="px-4 py-2 text-xs">{a.normalBalance === "DEBIT" ? "Debit" : "Kredit"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500">{a.lineCount || "–"}</td>
                {canManage && (
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <button type="button" onClick={() => setEditing({ code: a.code, name: a.name })} className="text-[#503200] hover:underline">
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => patch(a, { active: !a.active }, a.active ? "Akun dinonaktifkan" : "Akun diaktifkan")}
                        className="text-slate-600 hover:underline"
                      >
                        {a.active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      {a.group === "ASSET" && !a.isHeader && (
                        <button
                          type="button"
                          onClick={() => patch(a, { isCash: !a.isCash }, "Tipe akun diperbarui")}
                          className="text-sky-700 hover:underline"
                        >
                          {a.isCash ? "Bukan kas" : "Jadikan kas"}
                        </button>
                      )}
                      {a.lineCount === 0 && (
                        <button type="button" onClick={() => remove(a)} className="text-red-600 hover:underline">
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
