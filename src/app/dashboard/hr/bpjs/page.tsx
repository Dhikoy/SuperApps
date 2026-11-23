"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { formatRupiah } from "@/lib/payroll-policy";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type Enrollment = {
  userId: string;
  bpjsKes: string | null;
  bpjsTk: string | null;
  gajiPokok: number | null;
  user: { name: string; company: string | null };
  calc: { totalEmployer: number; totalEmployee: number } | null;
};

type UserOption = { nik: string; name: string };

export default function BpjsPage() {
  const { showToast } = useToast();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", bpjsKes: "", bpjsTk: "" });

  async function load() {
    const [eRes, uRes] = await Promise.all([
      hrFetchJson<{ enrollments: Enrollment[] }>("/api/hr/bpjs"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!eRes.ok) showToast(eRes.error, "error");
    else setEnrollments(eRes.data.enrollments ?? []);
    if (!uRes.ok) showToast(uRes.error, "error");
    else setUsers(Array.isArray(uRes.data) ? uRes.data : []);
  }

  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/bpjs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("BPJS didaftarkan", "success");
    setForm({ userId: "", bpjsKes: "", bpjsTk: "" });
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="BPJS" subtitle="Kepesertaan Kesehatan & Ketenagakerjaan" badge={`${enrollments.length} peserta`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field col-span-2" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <input placeholder="No. BPJS Kesehatan" value={form.bpjsKes} onChange={(e) => setForm({ ...form, bpjsKes: e.target.value })} className="input-field" />
        <input placeholder="No. BPJS TK" value={form.bpjsTk} onChange={(e) => setForm({ ...form, bpjsTk: e.target.value })} className="input-field" />
        <button type="submit" className="btn-primary col-span-2">Daftarkan BPJS</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Gaji Pokok</th>
              <th className="px-4 py-3">Iuran Perusahaan</th>
              <th className="px-4 py-3">Iuran Karyawan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {enrollments.map((e) => (
              <tr key={e.userId}>
                <td className="px-4 py-3 font-medium">{e.user.name}</td>
                <td className="px-4 py-3">{e.gajiPokok === null ? "—" : formatRupiah(e.gajiPokok)}</td>
                <td className="px-4 py-3">{e.calc ? formatRupiah(e.calc.totalEmployer) : "—"}</td>
                <td className="px-4 py-3">{e.calc ? formatRupiah(e.calc.totalEmployee) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
