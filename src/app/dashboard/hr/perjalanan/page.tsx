"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatRupiah } from "@/lib/payroll-policy";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type Trip = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  purpose: string | null;
  budget: number | null;
  approvalStatus: string;
  user: { name: string; company: string | null };
};

type UserOption = { nik: string; name: string };

export default function PerjalananPage() {
  const { showToast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", destination: "", startDate: "", endDate: "", purpose: "", budget: "" });

  async function load() {
    const [tRes, uRes] = await Promise.all([
      hrFetchJson<{ trips: Trip[] }>("/api/hr/business-trips"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!tRes.ok) showToast(tRes.error, "error");
    else setTrips(tRes.data.trips ?? []);
    if (!uRes.ok) showToast(uRes.error, "error");
    else setUsers(Array.isArray(uRes.data) ? uRes.data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/business-trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Perjalanan dinas diajukan", "success");
    setForm({ userId: "", destination: "", startDate: "", endDate: "", purpose: "", budget: "" });
    load();
  }

  async function setApproval(id: string, approvalStatus: "APPROVED" | "REJECTED") {
    const res = await hrFetchJson("/api/hr/business-trips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approvalStatus }),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast(approvalStatus === "APPROVED" ? "Perjalanan disetujui" : "Perjalanan ditolak", "success");
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="Perjalanan Dinas" subtitle="SPPD dan persetujuan perjalanan" badge={`${trips.length} perjalanan`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid grid-cols-2 gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field col-span-2" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <input placeholder="Tujuan" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="input-field col-span-2" required />
        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" required />
        <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" required />
        <input placeholder="Keperluan" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="input-field" />
        <input type="number" placeholder="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="input-field" />
        <button type="submit" className="btn-primary col-span-2">Ajukan Perjalanan</button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Tujuan</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trips.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.user.name}</td>
                <td className="px-4 py-3">{t.destination}</td>
                <td className="px-4 py-3">{t.budget ? formatRupiah(t.budget) : "-"}</td>
                <td className="px-4 py-3"><StatusBadge status={t.approvalStatus} /></td>
                <td className="px-4 py-3 space-x-2">
                  {t.approvalStatus === "PENDING" && (
                    <>
                      <button type="button" onClick={() => setApproval(t.id, "APPROVED")} className="text-xs text-emerald-600 font-medium">Approve</button>
                      <button type="button" onClick={() => setApproval(t.id, "REJECTED")} className="text-xs text-red-600 font-medium">Tolak</button>
                    </>
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
