"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type Contract = {
  id: string;
  type: string;
  startDate: string;
  endDate: string | null;
  status: string;
  user: { name: string; company: string | null; nik: string };
};

type UserOption = { nik: string; name: string };

function expiryBadge(endDate: string | null) {
  if (!endDate) return null;
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-xs font-medium text-red-600">Berakhir</span>;
  if (days <= 30) return <span className="text-xs font-medium text-amber-600">{days} hari lagi</span>;
  if (days <= 90) return <span className="text-xs text-slate-500">{days} hari lagi</span>;
  return null;
}

export default function KontrakPage() {
  const { showToast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", type: "PKWT", startDate: "", endDate: "" });

  async function load() {
    const [cRes, uRes] = await Promise.all([
      hrFetchJson<{ contracts: Contract[] }>("/api/hr/contracts"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!cRes.ok) showToast(cRes.error, "error");
    else setContracts(cRes.data.contracts ?? []);
    if (!uRes.ok) showToast(uRes.error, "error");
    else setUsers(Array.isArray(uRes.data) ? uRes.data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Kontrak disimpan", "success");
    setForm({ userId: "", type: "PKWT", startDate: "", endDate: "" });
    load();
  }

  const expiringSoon = contracts.filter((c) => {
    if (!c.endDate) return false;
    const days = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  });

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="Kontrak Kerja" subtitle="PKWT, PKWTT, dan masa berlaku" badge={`${contracts.length} kontrak`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      {expiringSoon.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {expiringSoon.length} kontrak berakhir dalam 30 hari — perpanjang atau update status.
        </div>
      )}

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field col-span-2" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
          <option value="PKWT">PKWT</option>
          <option value="PKWTT">PKWTT</option>
          <option value="MAGANG">Magang</option>
        </select>
        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" required />
        <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field col-span-2" />
        <button type="submit" className="btn-primary col-span-2">Simpan Kontrak</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Mulai</th>
              <th className="px-4 py-3">Berakhir</th>
              <th className="px-4 py-3">Reminder</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {contracts.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.user.name}</td>
                <td className="px-4 py-3">{c.type}</td>
                <td className="px-4 py-3">{new Date(c.startDate).toLocaleDateString("id-ID")}</td>
                <td className="px-4 py-3">{c.endDate ? new Date(c.endDate).toLocaleDateString("id-ID") : "—"}</td>
                <td className="px-4 py-3">{expiryBadge(c.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
