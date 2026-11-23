"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";
import { RichTextEditor } from "@/components/RichTextEditor";

type Exit = {
  id: string;
  resignDate: string;
  reason: string | null;
  status: string;
  user: { name: string; company: string | null; nik: string };
};

type UserOption = { nik: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pengajuan",
  APPROVED: "Disetujui",
  CLEARANCE: "Clearance",
  COMPLETED: "Selesai",
};

const nextStatus: Record<string, string> = {
  PENDING: "APPROVED",
  APPROVED: "CLEARANCE",
  CLEARANCE: "COMPLETED",
};

export default function ExitPage() {
  const { showToast } = useToast();
  const [exits, setExits] = useState<Exit[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", resignDate: "", reason: "" });

  async function load() {
    const [eRes, uRes] = await Promise.all([
      hrFetchJson<{ exits: Exit[] }>("/api/hr/exit"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!eRes.ok) showToast(eRes.error, "error");
    else setExits(eRes.data.exits ?? []);
    if (!uRes.ok) showToast(uRes.error, "error");
    else setUsers(Array.isArray(uRes.data) ? uRes.data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Pengajuan exit dibuat", "success");
    setForm({ userId: "", resignDate: "", reason: "" });
    load();
  }

  async function advance(id: string, status: string) {
    const res = await hrFetchJson("/api/hr/exit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast(`Status diperbarui → ${STATUS_LABELS[status] ?? status}`, "success");
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="Exit Management" subtitle="Offboarding, resign, dan clearance" badge={`${exits.length} proses`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        {["PENDING", "APPROVED", "CLEARANCE", "COMPLETED"].map((s, i) => (
          <span key={s}>
            {i > 0 && "→ "}
            <strong>{STATUS_LABELS[s]}</strong>
          </span>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <input type="date" value={form.resignDate} onChange={(e) => setForm({ ...form, resignDate: e.target.value })} className="input-field" required />
        <RichTextEditor
          value={form.reason}
          onChange={(html) => setForm({ ...form, reason: html })}
          placeholder="Alasan resign"
          minHeight={90}
        />
        <button type="submit" className="btn-primary">Ajukan Exit</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Tanggal Resign</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {exits.map((ex) => (
              <tr key={ex.id}>
                <td className="px-4 py-3 font-medium">{ex.user.name}</td>
                <td className="px-4 py-3">{new Date(ex.resignDate).toLocaleDateString("id-ID")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={ex.status} />
                  <span className="block text-xs text-slate-500 mt-0.5">{STATUS_LABELS[ex.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {nextStatus[ex.status] && (
                    <button type="button" onClick={() => advance(ex.id, nextStatus[ex.status])} className="text-xs text-blue-600 font-medium">
                      Lanjut → {STATUS_LABELS[nextStatus[ex.status]]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
