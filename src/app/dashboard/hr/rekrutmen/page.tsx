"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { CompanySelect } from "@/components/CompanySelect";
import { useToast } from "@/components/ToastProvider";

type Recruitment = {
  id: string;
  position: string;
  company: string;
  applicantName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

const STATUSES = ["OPEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "CLOSED"];

export default function RekrutmenPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Recruitment[]>([]);
  const [form, setForm] = useState({ position: "", company: "BCI", applicantName: "", email: "", phone: "" });

  function load() {
    fetch("/api/hr/recruitment")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => showToast("Gagal memuat data rekrutmen", "error"));
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/hr/recruitment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast("Gagal menambah kandidat", "error");
      return;
    }
    showToast("Kandidat ditambahkan", "success");
    setForm({ position: "", company: "BCI", applicantName: "", email: "", phone: "" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/hr/recruitment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Gagal update status", "error");
      return;
    }
    if (status === "HIRED" && data.createdUser) {
      showToast(`Akun dibuat: @${data.createdUser.userId} — wajib ganti password saat login pertama`, "success");
    } else {
      showToast(`Status diubah ke ${status}`, "success");
    }
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="Rekrutmen" subtitle="Pipeline kandidat dan posisi terbuka" badge={`${items.length} kandidat`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-3">
        <input placeholder="Posisi" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="input-field" required />
        <CompanySelect value={form.company} onChange={(company) => setForm({ ...form, company })} className="input-field" />
        <input placeholder="Nama kandidat" value={form.applicantName} onChange={(e) => setForm({ ...form, applicantName: e.target.value })} className="input-field col-span-2" required />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
        <input placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
        <button type="submit" className="btn-primary col-span-2">Tambah Kandidat</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Kandidat</th>
              <th className="px-4 py-3">Posisi</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.applicantName}</td>
                <td className="px-4 py-3">{item.position}</td>
                <td className="px-4 py-3">{item.company}</td>
                <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3">
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
