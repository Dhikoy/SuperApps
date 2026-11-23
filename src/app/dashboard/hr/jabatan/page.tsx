"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CompanySelect } from "@/components/CompanySelect";
import { formatRupiah } from "@/lib/payroll-policy";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type JobGrade = {
  id: string;
  title: string;
  grade: string;
  company: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  _count: { users: number };
};

export default function JabatanPage() {
  const { showToast } = useToast();
  const [grades, setGrades] = useState<JobGrade[]>([]);
  const [form, setForm] = useState({ title: "", grade: "G1", company: "BCI", minSalary: "", maxSalary: "" });

  async function load() {
    const res = await hrFetchJson<{ grades: JobGrade[] }>("/api/hr/job-grades");
    if (!res.ok) showToast(res.error, "error");
    else setGrades(res.data.grades ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/job-grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Jabatan ditambahkan", "success");
    setForm({ title: "", grade: "G1", company: "BCI", minSalary: "", maxSalary: "" });
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-3xl">
      <PageHeader title="Jabatan & Grade" subtitle="Master jabatan dan level grade" badge={`${grades.length} jabatan`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-3">
        <input placeholder="Nama jabatan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field col-span-2" required />
        <input placeholder="Grade (G1, G2...)" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="input-field" required />
        <CompanySelect value={form.company} onChange={(company) => setForm({ ...form, company })} className="input-field" />
        <input type="number" placeholder="Gaji min" value={form.minSalary} onChange={(e) => setForm({ ...form, minSalary: e.target.value })} className="input-field" />
        <input type="number" placeholder="Gaji max" value={form.maxSalary} onChange={(e) => setForm({ ...form, maxSalary: e.target.value })} className="input-field" />
        <button type="submit" className="btn-primary col-span-2">Tambah Jabatan</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Jabatan</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Range Gaji</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {grades.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-3 font-medium">{g.title}</td>
                <td className="px-4 py-3">{g.grade}</td>
                <td className="px-4 py-3">{g.company ?? "-"}</td>
                <td className="px-4 py-3">
                  {g.minSalary ? formatRupiah(g.minSalary) : "-"} — {g.maxSalary ? formatRupiah(g.maxSalary) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
