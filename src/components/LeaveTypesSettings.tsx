"use client";

import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/ui";

type LeaveType = {
  id: string;
  name: string;
  requiresAtasan: boolean;
  isActive: boolean;
};

function flowLabel(requiresAtasan: boolean) {
  return requiresAtasan ? "Atasan → HRD" : "Langsung HRD";
}

export function LeaveTypesSettings() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [name, setName] = useState("");
  const [requiresAtasan, setRequiresAtasan] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const activeTypes = types.filter((t) => t.isActive);
  const inactiveTypes = types.filter((t) => !t.isActive);

  function load() {
    fetch("/api/leave-types?all=1")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setTypes)
      .catch(() => setTypes([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setMessage(null);
    const res = await fetch("/api/leave-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, requiresAtasan }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal menambah jenis cuti" });
      return;
    }

    setName("");
    setRequiresAtasan(true);
    setMessage({ type: "success", text: `Jenis cuti "${data.name}" berhasil ditambahkan.` });
    load();
  }

  async function deactivateType(type: LeaveType) {
    const ok = confirm(
      `Nonaktifkan jenis cuti "${type.name}"?\n\nKaryawan tidak bisa mengajukan jenis ini sampai diaktifkan kembali.`
    );
    if (!ok) return;

    setBusyId(type.id);
    setMessage(null);

    const res = await fetch(`/api/leave-types/${type.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal menonaktifkan jenis cuti" });
      setBusyId(null);
      return;
    }

    setMessage({ type: "success", text: `Jenis cuti "${type.name}" berhasil dinonaktifkan.` });
    setBusyId(null);
    load();
  }

  async function activateType(type: LeaveType) {
    const ok = confirm(
      `Aktifkan kembali jenis cuti "${type.name}"?\n\nJenis ini akan muncul lagi di form pengajuan cuti.`
    );
    if (!ok) return;

    setBusyId(type.id);
    setMessage(null);

    const res = await fetch(`/api/leave-types/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal mengaktifkan jenis cuti" });
      setBusyId(null);
      return;
    }

    setMessage({ type: "success", text: `Jenis cuti "${type.name}" berhasil diaktifkan kembali.` });
    setBusyId(null);
    load();
  }

  async function deleteTypePermanently(type: LeaveType) {
    const ok = confirm(
      `Hapus permanen jenis cuti "${type.name}"?\n\nData jenis cuti akan dihapus dari sistem dan tidak bisa dikembalikan.`
    );
    if (!ok) return;

    setBusyId(type.id);
    setMessage(null);

    const res = await fetch(`/api/leave-types/${type.id}?permanent=1`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal menghapus jenis cuti" });
      setBusyId(null);
      return;
    }

    setMessage({ type: "success", text: `Jenis cuti "${type.name}" berhasil dihapus permanen.` });
    setBusyId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addType} className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama jenis cuti baru"
          className={INPUT_CLASS}
          required
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 px-2 shrink-0">
          <input
            type="checkbox"
            checked={requiresAtasan}
            onChange={(e) => setRequiresAtasan(e.target.checked)}
          />
          Perlu approval atasan
        </label>
        <button type="submit" className="btn-primary shrink-0 px-4">
          Tambah
        </button>
      </form>

      {message && (
        <p
          className={`text-sm ${message.type === "error" ? "text-red-600" : "text-emerald-700"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Jenis Cuti Aktif</h3>
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {activeTypes.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500 text-center bg-white">
              Belum ada jenis cuti aktif
            </li>
          ) : (
            activeTypes.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm bg-white gap-4">
                <div>
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-slate-500 text-xs">{flowLabel(t.requiresAtasan)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deactivateType(t)}
                  disabled={busyId === t.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors shrink-0"
                >
                  {busyId === t.id ? "..." : "Nonaktifkan"}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {inactiveTypes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Jenis Cuti Nonaktif</h3>
          <p className="text-xs text-slate-500 mb-2">
            Jenis cuti yang dinonaktifkan tidak muncul di form pengajuan. Bisa diaktifkan kembali atau dihapus permanen
            (khusus jenis custom).
          </p>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {inactiveTypes.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between px-4 py-3 text-sm bg-slate-50 gap-4"
              >
                <div>
                  <p className="font-medium text-slate-600">{t.name}</p>
                  <p className="text-slate-400 text-xs">{flowLabel(t.requiresAtasan)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => activateType(t)}
                    disabled={busyId === t.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {busyId === t.id ? "..." : "Aktifkan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTypePermanently(t)}
                    disabled={busyId === t.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
