"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { CompanySelect } from "@/components/CompanySelect";
import { JOURNAL_SOURCE_LABELS, formatAccounting, type JournalSourceKey } from "@/lib/accounting/constants";
import { AccountSelect } from "./AccountSelect";
import { defaultRange, rangeQuery, ReportFilterBar, ymdJakarta, type ReportRange } from "./ReportFilterBar";

type Line = { accountCode: string; accountName?: string; debit: number; credit: number; memo: string | null };
type Entry = {
  id: string;
  number: string;
  date: string;
  company: string;
  description: string;
  source: JournalSourceKey;
  locked: boolean;
  totalDebit: number;
  lines: Line[];
};
type ListData = { entries: Entry[]; total: number; page: number; pageSize: number };

type FormLine = { accountCode: string; debit: string; credit: string; memo: string };
type FormState = { id: string | null; date: string; company: string; description: string; source: "MANUAL" | "OPENING"; lines: FormLine[] };

const blankLine = (): FormLine => ({ accountCode: "", debit: "", credit: "", memo: "" });
const blankForm = (): FormState => ({
  id: null,
  date: ymdJakarta(new Date()),
  company: "BCI",
  description: "",
  source: "MANUAL",
  lines: [blankLine(), blankLine()],
});

export function JournalManager({ canManage }: { canManage: boolean }) {
  const { showToast } = useToast();
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const query = rangeQuery(range, { ...(source ? { source } : {}), ...(q.trim() ? { q: q.trim() } : {}), page: String(page) });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/finance/accounting/journals?${query}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query, version]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(e: Entry) {
    setForm({
      id: e.id,
      date: ymdJakarta(new Date(e.date)),
      company: e.company,
      description: e.description,
      source: e.source === "OPENING" ? "OPENING" : "MANUAL",
      lines: e.lines.map((l) => ({
        accountCode: l.accountCode,
        debit: l.debit ? String(l.debit) : "",
        credit: l.credit ? String(l.credit) : "",
        memo: l.memo ?? "",
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(e: Entry) {
    if (!confirm(`Hapus jurnal ${e.number}?`)) return;
    const res = await fetch(`/api/finance/accounting/journals/${e.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(body.error ?? "Gagal menghapus", "error");
    showToast("Jurnal dihapus", "success");
    setVersion((v) => v + 1);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form) return;
    setSaving(true);
    const res = await fetch(form.id ? `/api/finance/accounting/journals/${form.id}` : "/api/finance/accounting/journals", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        company: form.company,
        description: form.description,
        source: form.source,
        lines: form.lines.map((l) => ({
          accountCode: l.accountCode,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          memo: l.memo,
        })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return showToast(body.error ?? "Gagal menyimpan jurnal", "error");
    showToast(form.id ? "Jurnal diperbarui" : `Jurnal ${body.number} tersimpan`, "success");
    setForm(null);
    setVersion((v) => v + 1);
  }

  const totalDebit = form?.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) ?? 0;
  const totalCredit = form?.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) ?? 0;
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function updateLine(idx: number, patch: Partial<FormLine>) {
    setForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : f));
  }

  return (
    <div className="space-y-4">
      {canManage && !form && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setForm(blankForm())} className="btn-primary">+ Jurnal Umum</button>
          <button type="button" onClick={() => setForm({ ...blankForm(), source: "OPENING", description: "Saldo awal" })} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            + Saldo Awal
          </button>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              {form.id ? "Edit jurnal" : form.source === "OPENING" ? "Jurnal saldo awal" : "Jurnal umum baru"}
            </h2>
            <button type="button" onClick={() => setForm(null)} className="text-sm text-slate-500 hover:underline">Batal</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">
              Tanggal
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field mt-1" required />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Perusahaan
              <CompanySelect value={form.company} onChange={(company) => setForm({ ...form, company })} className="input-field mt-1" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Tipe
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as FormState["source"] })} className="input-field mt-1">
                <option value="MANUAL">Jurnal Umum</option>
                <option value="OPENING">Saldo Awal</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Keterangan
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field mt-1" required placeholder="mis. Penyusutan Oktober" />
            </label>
          </div>

          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-2 text-xs font-semibold uppercase text-slate-500">
              <span>Akun</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Kredit</span>
              <span>Memo</span>
              <span />
            </div>
            {form.lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <AccountSelect value={l.accountCode} onChange={(accountCode) => updateLine(idx, { accountCode })} required />
                </div>
                <input type="number" min="0" step="any" value={l.debit} onChange={(e) => updateLine(idx, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} placeholder="Debit" className="input-field text-right" />
                <input type="number" min="0" step="any" value={l.credit} onChange={(e) => updateLine(idx, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} placeholder="Kredit" className="input-field text-right" />
                <input value={l.memo} onChange={(e) => updateLine(idx, { memo: e.target.value })} placeholder="Memo (opsional)" className="input-field col-span-2 sm:col-span-1" />
                <button
                  type="button"
                  disabled={form.lines.length <= 2}
                  onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}
                  className="text-sm text-red-600 disabled:opacity-30"
                  aria-label="Hapus baris"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })} className="text-sm font-medium text-blue-600">
              + Tambah baris
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 pt-3">
            <p className={`text-sm font-semibold ${balanced ? "text-emerald-700" : "text-red-600"}`}>
              Debit {formatAccounting(totalDebit)} · Kredit {formatAccounting(totalCredit)} ·{" "}
              {balanced ? "Seimbang" : `Selisih ${formatAccounting(totalDebit - totalCredit)}`}
            </p>
            <button type="submit" disabled={saving || !balanced} className="btn-primary">
              {saving ? "Menyimpan…" : "Simpan jurnal"}
            </button>
          </div>
        </form>
      )}

      <ReportFilterBar value={range} onChange={(r) => { setRange(r); setPage(1); }}>
        <label className="text-xs font-medium text-slate-600">
          Sumber
          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="input-field mt-1">
            <option value="">Semua</option>
            {(Object.keys(JOURNAL_SOURCE_LABELS) as JournalSourceKey[]).map((s) => (
              <option key={s} value={s}>{JOURNAL_SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Cari
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="No. jurnal / keterangan / kode akun" className="input-field mt-1" />
        </label>
      </ReportFilterBar>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">No. Jurnal</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3">Sumber</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Memuat…</td></tr>
            )}
            {!loading && data?.entries.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Belum ada jurnal</td></tr>
            )}
            {!loading &&
              data?.entries.map((e) => (
                <EntryRows
                  key={e.id}
                  entry={e}
                  open={expanded.has(e.id)}
                  onToggle={() => toggle(e.id)}
                  canManage={canManage}
                  onEdit={() => startEdit(e)}
                  onDelete={() => remove(e)}
                />
              ))}
          </tbody>
        </table>
      </div>

      {data && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">‹</button>
          <span>Hal {page} / {pages} · {data.total} jurnal</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  );
}

function EntryRows({
  entry,
  open,
  onToggle,
  canManage,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2 whitespace-nowrap">{new Date(entry.date).toLocaleDateString("id-ID")}</td>
        <td className="px-4 py-2 font-mono text-xs">{entry.number}</td>
        <td className="px-4 py-2">{entry.company}</td>
        <td className="px-4 py-2">{entry.description}</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.locked ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"}`}>
            {JOURNAL_SOURCE_LABELS[entry.source]}
          </span>
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{formatAccounting(entry.totalDebit)}</td>
        <td className="px-4 py-2 text-slate-400">{open ? "▾" : "▸"}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50/60">
          <td colSpan={7} className="px-4 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Akun</th>
                  <th className="py-1">Memo</th>
                  <th className="py-1 text-right">Debit</th>
                  <th className="py-1 text-right">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i}>
                    <td className={`py-1 ${l.credit ? "pl-6" : ""}`}>
                      <span className="font-mono">{l.accountCode}</span> {l.accountName}
                    </td>
                    <td className="py-1 text-slate-500">{l.memo}</td>
                    <td className="py-1 text-right tabular-nums">{formatAccounting(l.debit)}</td>
                    <td className="py-1 text-right tabular-nums">{formatAccounting(l.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {entry.locked ? (
                <span className="text-slate-500">Jurnal otomatis — ubah lewat transaksi sumbernya.</span>
              ) : (
                canManage && (
                  <>
                    <button type="button" onClick={onEdit} className="font-semibold text-[#503200] hover:underline">Edit</button>
                    <button type="button" onClick={onDelete} className="font-semibold text-red-600 hover:underline">Hapus</button>
                  </>
                )
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
