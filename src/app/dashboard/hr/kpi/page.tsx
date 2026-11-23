"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";
import { RichTextEditor } from "@/components/RichTextEditor";

type Review = {
  id: string;
  period: string;
  score: number;
  kpiNotes: string | null;
  reviewerNik: string | null;
  user: { name: string; company: string | null };
};

type UserOption = { nik: string; name: string };

const KPI_PERIODS = ["2026-H1", "2026-H2", "2027-H1", "2027-H2", "2028-H1", "2028-H2"];

export default function KpiPage() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", period: "2026-H1", score: "80", kpiNotes: "" });

  async function load() {
    const [rRes, uRes] = await Promise.all([
      hrFetchJson<{ reviews: Review[] }>("/api/hr/kpi"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!rRes.ok) showToast(rRes.error, "error");
    else setReviews(rRes.data.reviews ?? []);
    if (!uRes.ok) showToast(uRes.error, "error");
    else setUsers(Array.isArray(uRes.data) ? uRes.data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/kpi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Penilaian KPI disimpan", "success");
    setForm({ userId: "", period: "2026-H1", score: "80", kpiNotes: "" });
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-3xl">
      <PageHeader title="Penilaian Kinerja (KPI)" subtitle="Review kinerja per periode" badge={`${reviews.length} review`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="input-field" required>
          {KPI_PERIODS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input type="number" min="0" max="100" placeholder="Skor 0-100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="input-field" required />
        <RichTextEditor
          value={form.kpiNotes}
          onChange={(html) => setForm({ ...form, kpiNotes: html })}
          placeholder="Catatan KPI"
          minHeight={100}
        />
        <button type="submit" className="btn-primary">Simpan Penilaian</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Periode</th>
              <th className="px-4 py-3">Skor</th>
              <th className="px-4 py-3">Reviewer</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reviews.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.user.name}</td>
                <td className="px-4 py-3">{r.period}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${r.score >= 80 ? "text-emerald-600" : r.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                    {r.score}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{r.reviewerNik ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
