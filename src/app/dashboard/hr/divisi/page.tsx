"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CompanySelect } from "@/components/CompanySelect";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type Department = {
  id: string;
  name: string;
  company: string;
  headNik: string | null;
  description: string | null;
  _count: { users: number };
};

export default function DivisiPage() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ name: "", company: "BCI", description: "" });

  async function load() {
    const res = await hrFetchJson<{ departments: Department[] }>("/api/hr/departments");
    if (!res.ok) showToast(res.error, "error");
    else setDepartments(res.data.departments ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Divisi ditambahkan", "success");
    setForm({ name: "", company: "BCI", description: "" });
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-3xl">
      <PageHeader title="Divisi" subtitle="Departemen/divisi per perusahaan" badge={`${departments.length} divisi`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid gap-3">
        <input placeholder="Nama divisi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
        <CompanySelect value={form.company} onChange={(company) => setForm({ ...form, company })} className="input-field" />
        <input placeholder="Deskripsi (opsional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
        <button type="submit" className="btn-primary">Tambah Divisi</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Divisi</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Karyawan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {departments.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.company}</td>
                <td className="px-4 py-3">{d._count.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
