"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApprovalFlowLabel } from "@/lib/leave-shared";
import { INPUT_CLASS } from "@/components/ui";
import { RichTextEditor } from "@/components/RichTextEditor";

type LeaveTypeOption = { name: string; requiresAtasan: boolean };

export default function AjukanCutiPage() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [form, setForm] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    remarks: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/leave-types")
      .then(async (r) => {
        if (!r.ok) throw new Error("Gagal memuat jenis cuti");
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error("Data jenis cuti tidak valid");
        return data.map((t: { name: string; requiresAtasan: boolean }) => ({
          name: t.name,
          requiresAtasan: t.requiresAtasan,
        }));
      })
      .then((types) => {
        setLeaveTypes(types);
        if (types.length > 0) {
          setForm((prev) => ({
            ...prev,
            leaveType: types.some((t) => t.name === prev.leaveType) ? prev.leaveType : types[0].name,
          }));
        }
      })
      .catch(() => setError("Gagal memuat jenis cuti. Muat ulang halaman."))
      .finally(() => setLoadingTypes(false));
  }, []);

  const selected = leaveTypes.find((t) => t.name === form.leaveType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Gagal mengajuan cuti");
      setLoading(false);
      return;
    }

    router.push("/dashboard/cuti");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ajukan Cuti / Izin</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Alur: {getApprovalFlowLabel(form.leaveType, selected?.requiresAtasan ?? true)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Jenis</label>
          <select
            value={form.leaveType}
            onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
            className={INPUT_CLASS}
            disabled={loadingTypes || leaveTypes.length === 0}
            required
          >
            {loadingTypes ? (
              <option value="">Memuat jenis cuti...</option>
            ) : leaveTypes.length === 0 ? (
              <option value="">Belum ada jenis cuti</option>
            ) : (
              leaveTypes.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={INPUT_CLASS} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={INPUT_CLASS} required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
          <RichTextEditor
            value={form.remarks}
            onChange={(html) => setForm({ ...form, remarks: html })}
            placeholder="Alasan / keterangan cuti..."
            minHeight={100}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading || loadingTypes || leaveTypes.length === 0} className="btn-primary w-full">
          {loading ? "Mengirim..." : "Ajukan"}
        </button>
      </form>
    </div>
  );
}
