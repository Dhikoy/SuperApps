"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { canManagePenalty, type Role } from "@/lib/roles";

type Entry = {
  id: string;
  userId: string;
  company: string;
  points: number;
  note: string;
  createdByName: string;
  createdAt: string;
};

type Modal =
  | { mode: "add"; nik: string; name: string; company: string | null }
  | { mode: "list"; nik: string; name: string; company: string | null }
  | { mode: "edit"; entry: Entry; name: string };

export function usePenaltyDay(date: string) {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lockedCompanies, setLockedCompanies] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [points, setPoints] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setEnabled(canManagePenalty(data.role as Role)))
      .catch(() => setEnabled(false));
  }, []);

  const reload = useCallback(() => {
    if (!enabled || !date) return;
    fetch(`/api/penalties?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setLockedCompanies(Array.isArray(data.lockedCompanies) ? data.lockedCompanies : []);
      })
      .catch(() => {
        setEntries([]);
        setLockedCompanies([]);
      });
  }, [date, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byNik = useMemo(() => {
    const map = new Map<string, { total: number; entries: Entry[] }>();
    for (const entry of entries) {
      const prev = map.get(entry.userId) ?? { total: 0, entries: [] };
      prev.total += entry.points;
      prev.entries.push(entry);
      map.set(entry.userId, prev);
    }
    return map;
  }, [entries]);

  function isLocked(company: string | null) {
    if (!company) return false;
    const key = company.toUpperCase();
    return lockedCompanies.some((item) => item.toUpperCase() === key);
  }

  function openAdd(row: { nik: string; name: string; company: string | null }) {
    setPoints("1");
    setNote("");
    setModal({ mode: "add", ...row });
  }

  function openList(row: { nik: string; name: string; company: string | null }) {
    setModal({ mode: "list", ...row });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || modal.mode === "list") return;
    setSaving(true);
    const payload = { points: Number(points), note };
    const res =
      modal.mode === "add"
        ? await fetch("/api/penalties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId: modal.nik, date, ...payload }),
          })
        : await fetch(`/api/penalties/${modal.entry.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      showToast(typeof data.error === "string" ? data.error : "Gagal menyimpan penalti", "error");
      return;
    }
    showToast(modal.mode === "add" ? "Penalti ditambahkan" : "Penalti diperbarui", "success");
    setModal(null);
    reload();
  }

  async function remove(entry: Entry) {
    if (!confirm("Hapus penalti ini?")) return;
    const res = await fetch(`/api/penalties/${entry.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(typeof data.error === "string" ? data.error : "Gagal menghapus", "error");
      return;
    }
    showToast("Penalti dihapus", "success");
    setModal(null);
    reload();
  }

  const listEntries = modal && modal.mode !== "add" ? byNik.get(modal.mode === "list" ? modal.nik : modal.entry.userId)?.entries ?? [] : [];

  return {
    enabled,
    byNik,
    isLocked,
    openAdd,
    openList,
    modal,
    setModal,
    points,
    setPoints,
    note,
    setNote,
    saving,
    submit,
    remove,
    listEntries,
  };
}

export function PenaltyModals(props: ReturnType<typeof usePenaltyDay> & { date: string }) {
  const { modal, setModal, points, setPoints, note, setNote, saving, submit, remove, listEntries, isLocked, date } = props;
  if (!modal) return null;

  const locked = isLocked(modal.mode === "edit" ? modal.entry.company : modal.company);
  const titleName = modal.mode === "edit" ? modal.name : modal.name;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        {modal.mode === "list" ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Penalti {titleName}</h3>
                <p className="text-xs text-slate-500">{date}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="text-sm text-slate-500">
                Tutup
              </button>
            </div>
            {locked && <p className="text-sm text-amber-700">Periode ini sudah dikunci.</p>}
            <ul className="divide-y divide-slate-100">
              {listEntries.map((entry) => (
                <li key={entry.id} className="py-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{entry.points} poin</p>
                    {!locked && (
                      <div className="flex gap-3 text-xs font-medium">
                        <button
                          type="button"
                          className="text-[#503200]"
                          onClick={() => {
                            setPoints(String(entry.points));
                            setNote(entry.note);
                            setModal({ mode: "edit", entry, name: titleName });
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="text-red-600" onClick={() => remove(entry)}>
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{entry.note}</p>
                  <p className="text-xs text-slate-400">
                    {entry.createdByName} · {new Date(entry.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {modal.mode === "add" ? "Tambah penalti" : "Edit penalti"}
                </h3>
                <p className="text-xs text-slate-500">
                  {titleName} · {date}
                </p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="text-sm text-slate-500">
                Tutup
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-500">
              Poin
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Catatan / alasan
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                required
              />
            </label>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
