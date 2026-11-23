"use client";

import { useCallback, useEffect, useState } from "react";
import { INPUT_CLASS, PageHeader, AlertBanner } from "@/components/ui";
import type { CompanyRow } from "@/lib/companies";
import { DEFAULT_COMPANIES } from "@/lib/companies";

const emptyForm = { code: "", name: "", description: "" };

export function CompanyManager({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies?all=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat daftar PT");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat daftar PT");
      setRows(DEFAULT_COMPANIES.map((code, i) => ({
        code,
        name: code,
        description: null,
        isActive: true,
        sortOrder: i + 1,
        employeeCount: 0,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving("new");
    setError("");

    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Gagal menambah PT");
      setSaving(null);
      return;
    }

    setRows((prev) => [...prev, data].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)));
    setForm(emptyForm);
    setShowForm(false);
    setSaving(null);
  }

  async function updateRow(code: string, patch: Partial<CompanyRow>) {
    setSaving(code);
    setError("");

    const res = await fetch(`/api/companies/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan");
      setSaving(null);
      return;
    }

    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, ...data } : r)));
    setSaving(null);
  }

  async function handleDelete(code: string) {
    if (!confirm(`Hapus PT ${code}? Hanya bisa jika belum ada karyawan.`)) return;
    setSaving(code);
    setError("");

    const res = await fetch(`/api/companies/${code}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Gagal menghapus");
      setSaving(null);
      return;
    }

    setRows((prev) => prev.filter((r) => r.code !== code));
    setSaving(null);
  }

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perusahaan (PT)"
        subtitle="Kelola daftar PT — dipakai di karyawan, task, presensi, keuangan, dan modul lain"
        badge={loading ? undefined : `${activeCount} aktif / ${rows.length} total`}
      />

      {error && <AlertBanner variant="warning">{error}</AlertBanner>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary"
        >
          {showForm ? "Batal" : "+ Tambah PT"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kode PT</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={INPUT_CLASS}
              placeholder="Contoh: ABC"
              maxLength={10}
              required
            />
            <p className="mt-1 text-xs text-slate-500">2–10 karakter, huruf/angka, otomatis uppercase</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama PT</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={INPUT_CLASS}
              placeholder="Nama lengkap perusahaan"
              required
            />
            <p className="mt-1 text-xs text-slate-500">Dipakai sebagai KOP invoice, pengajuan dana, dan kwitansi</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi (opsional)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={INPUT_CLASS}
              placeholder="Catatan singkat"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving === "new"} className="btn-primary disabled:opacity-50">
              {saving === "new" ? "Menyimpan..." : "Simpan PT Baru"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Memuat daftar PT...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-48">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <CompanyRowItem
                    key={row.code}
                    row={row}
                    saving={saving === row.code}
                    canDelete={canDelete}
                    onSave={updateRow}
                    onDelete={handleDelete}
                  />
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Belum ada PT. Tambahkan PT pertama.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Setting presensi per PT (lokasi kantor, shift) ada di{" "}
        <a href="/dashboard/pengaturan" className="text-[#503200] font-medium hover:underline">
          Pengaturan
        </a>
        . <strong>Nama</strong> PT dipakai sebagai KOP dokumen keuangan (invoice, pengajuan dana, kwitansi) yang
        dibuat atau diubah setelahnya. Tombol <strong>Hapus</strong> PT hanya muncul jika belum ada karyawan — kalau masih ada karyawan,
        gunakan status <strong>Nonaktif</strong>.
      </p>
    </div>
  );
}

function CompanyRowItem({
  row,
  saving,
  canDelete,
  onSave,
  onDelete,
}: {
  row: CompanyRow;
  saving: boolean;
  canDelete: boolean;
  onSave: (code: string, patch: Partial<CompanyRow>) => void;
  onDelete: (code: string) => void;
}) {
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? "");

  useEffect(() => {
    setName(row.name);
    setDescription(row.description ?? "");
  }, [row.name, row.description]);

  return (
    <tr className={!row.isActive ? "bg-slate-50/80 opacity-75" : undefined}>
      <td className="px-4 py-3 font-mono font-semibold text-[#503200]">{row.code}</td>
      <td className="px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${INPUT_CLASS} !py-1.5 text-sm`}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi"
          className={`${INPUT_CLASS} !py-1.5 text-xs mt-1 text-slate-500`}
        />
      </td>
      <td className="px-4 py-3 text-slate-600">{row.employeeCount ?? 0}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(row.code, { isActive: !row.isActive })}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.isActive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {row.isActive ? "Aktif" : "Nonaktif"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(row.code, { name, description: description || null })}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#503200] bg-[#fdf6e8] ring-1 ring-[#e8dfd0] hover:bg-[#f7c200]/20 disabled:opacity-50"
          >
            {saving ? "..." : "Simpan"}
          </button>
          {canDelete && (row.employeeCount ?? 0) === 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onDelete(row.code)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              Hapus
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
