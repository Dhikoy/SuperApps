"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { formatRupiah } from "@/lib/payroll-policy";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type Profile = {
  userId: string;
  npwp: string | null;
  ptkpStatus: string;
  gajiPokok: number | null;
  user: { name: string; company: string | null };
  calc: { pphBulanan: number; pkp: number } | null;
};

type UserOption = { nik: string; name: string };

const PTKP_OPTIONS = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"];

export default function Pph21Page() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", npwp: "", ptkpStatus: "TK/0" });

  async function load() {
    const [pRes, uRes] = await Promise.all([
      hrFetchJson<{ profiles: Profile[] }>("/api/hr/pph21"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!pRes.ok) showToast(pRes.error, "error");
    else setProfiles(pRes.data.profiles ?? []);
    if (!uRes.ok) showToast(uRes.error, "error");
    else setUsers(Array.isArray(uRes.data) ? uRes.data : []);
  }

  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/pph21", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Profil pajak disimpan", "success");
    setForm({ userId: "", npwp: "", ptkpStatus: "TK/0" });
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="PPh 21" subtitle="Profil pajak dan estimasi potongan bulanan" badge={`${profiles.length} profil`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field col-span-2" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <input placeholder="NPWP" value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} className="input-field" />
        <select value={form.ptkpStatus} onChange={(e) => setForm({ ...form, ptkpStatus: e.target.value })} className="input-field">
          {PTKP_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="submit" className="btn-primary col-span-2">Simpan Profil Pajak</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">PTKP</th>
              <th className="px-4 py-3">Gaji Bruto</th>
              <th className="px-4 py-3">PPh 21 / bulan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {profiles.map((p) => (
              <tr key={p.userId}>
                <td className="px-4 py-3 font-medium">{p.user.name}</td>
                <td className="px-4 py-3">{p.ptkpStatus}</td>
                <td className="px-4 py-3">{p.gajiPokok === null ? "—" : formatRupiah(p.gajiPokok)}</td>
                <td className="px-4 py-3 font-semibold text-red-600">{p.calc ? formatRupiah(p.calc.pphBulanan) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
