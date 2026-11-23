"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { plainTextFromHtml } from "@/lib/rich-text";

type Overtime = {
  id: string;
  date: string;
  hours: number;
  type: string;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  remarks: string | null;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  user: { name: string; userId: string; company: string | null };
};

type Employee = { nik: string; name: string; company: string | null };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

const EMPTY_FORM = { date: "", startTime: "", endTime: "", hours: "", description: "", remarks: "" };

function hoursBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 2) / 2;
}

export function OvertimeManager({ canManage, employees }: { canManage: boolean; employees: Employee[] }) {
  const [overtimes, setOvertimes] = useState<Overtime[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [forEmployees, setForEmployees] = useState(canManage);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(canManage ? "PENDING_FIRST" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOvertimes = useCallback(() => {
    fetch(canManage ? "/api/payroll/overtime?scope=all" : "/api/payroll/overtime")
      .then(async (r) => {
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setOvertimes)
      .catch(() => setOvertimes([]));
  }, [canManage]);

  useEffect(() => {
    loadOvertimes();
  }, [loadOvertimes]);

  const companies = useMemo(
    () => [...new Set(employees.map((e) => e.company ?? "-"))].sort(),
    [employees]
  );

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (!companyFilter || (e.company ?? "-") === companyFilter) &&
        (!q || e.name.toLowerCase().includes(q))
    );
  }, [employees, search, companyFilter]);

  const shownOvertimes = useMemo(() => {
    if (statusFilter === "PENDING_FIRST") {
      return [...overtimes].sort(
        (a, b) => Number(b.approvalStatus === "PENDING") - Number(a.approvalStatus === "PENDING")
      );
    }
    return statusFilter ? overtimes.filter((o) => o.approvalStatus === statusFilter) : overtimes;
  }, [overtimes, statusFilter]);

  const pendingCount = overtimes.filter((o) => o.approvalStatus === "PENDING").length;

  function toggle(nik: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nik)) next.delete(nik);
      else next.add(nik);
      return next;
    });
  }

  function selectVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of visibleEmployees) {
        if (checked) next.add(e.nik);
        else next.delete(e.nik);
      }
      return next;
    });
  }

  function updateTime(field: "startTime" | "endTime", value: string) {
    const next = { ...form, [field]: value };
    if (next.startTime && next.endTime) next.hours = String(hoursBetween(next.startTime, next.endTime));
    setForm(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (forEmployees && selected.size === 0) {
      setError("Pilih minimal satu karyawan");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/payroll/overtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        hours: Number(form.hours),
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        description: form.description || null,
        remarks: form.remarks || null,
        ...(forEmployees ? { userIds: [...selected] } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan lembur");
      return;
    }

    if (forEmployees) {
      const skipped: { name: string; reason: string }[] = data.skipped ?? [];
      setMessage(
        `${data.created} lembur tersimpan & langsung disetujui.` +
          (skipped.length ? ` Dilewati: ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}` : "")
      );
      setSelected(new Set());
    } else {
      setMessage("Pengajuan lembur terkirim, menunggu persetujuan.");
    }
    setForm(EMPTY_FORM);
    loadOvertimes();
  }

  async function handleApprove(id: string, status: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/payroll/overtime/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Gagal memproses persetujuan");
    }
    loadOvertimes();
  }

  const allVisibleSelected = visibleEmployees.length > 0 && visibleEmployees.every((e) => selected.has(e.nik));

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{canManage ? "Lembur Karyawan" : "Pengajuan Lembur"}</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Tarif per jam = gaji pokok ÷ 173 · Hari kerja ×1 · Libur nasional ×2 — isi jam mulai/selesai & detail pekerjaan
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl bg-white p-6 shadow-sm border border-slate-100 space-y-4">
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForEmployees(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${forEmployees ? "bg-[#1a2332] text-white" : "border border-slate-300 text-slate-600"}`}
            >
              Input untuk karyawan
            </button>
            <button
              type="button"
              onClick={() => setForEmployees(false)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!forEmployees ? "bg-[#1a2332] text-white" : "border border-slate-300 text-slate-600"}`}
            >
              Ajukan untuk diri sendiri
            </button>
          </div>
        )}

        {forEmployees && (
          <div className="rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama..."
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">Semua PT</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={allVisibleSelected} onChange={(e) => selectVisible(e.target.checked)} />
                Pilih semua yang tampil
              </label>
              <span className="ml-auto text-sm font-medium text-orange-600">{selected.size} karyawan dipilih</span>
            </div>
            <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleEmployees.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada karyawan</p>
              ) : (
                visibleEmployees.map((emp) => (
                  <label key={emp.nik} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(emp.nik)} onChange={() => toggle(emp.nik)} />
                    <span className="truncate">{emp.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{emp.company ?? "-"}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal Lembur</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Total Jam</label>
            <input type="number" step="0.5" min="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Jam Mulai</label>
            <input type="time" value={form.startTime} onChange={(e) => updateTime("startTime", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Jam Selesai</label>
            <input type="time" value={form.endTime} onChange={(e) => updateTime("endTime", e.target.value)} className="input-field" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Detail Pekerjaan Lembur</label>
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm({ ...form, description: html })}
            placeholder="Contoh: Penyelesaian laporan keuangan bulanan"
            minHeight={90}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Catatan Tambahan</label>
          <input type="text" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field" placeholder="Opsional" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading
            ? "Menyimpan..."
            : forEmployees
              ? `Simpan & Setujui${selected.size ? ` (${selected.size} karyawan)` : ""}`
              : "Ajukan Lembur"}
        </button>
      </form>

      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold">
            Riwayat Lembur
            {canManage && pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{pendingCount} menunggu</span>
            )}
          </h2>
          {canManage && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="PENDING_FIRST">Semua (menunggu di atas)</option>
              <option value="PENDING">Menunggu</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          )}
        </div>
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              {canManage && <th className="px-4 py-3">Karyawan</th>}
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Jam</th>
              <th className="px-4 py-3">Mulai–Selesai</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shownOvertimes.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 6} className="px-6 py-8 text-center text-slate-500">
                  Belum ada data lembur
                </td>
              </tr>
            ) : (
              shownOvertimes.map((ot) => (
                <tr key={ot.id}>
                  {canManage && (
                    <td className="px-4 py-3">
                      <p className="font-medium">{ot.user.name}</p>
                      <p className="text-xs text-slate-400">{ot.user.company ?? "-"}</p>
                    </td>
                  )}
                  <td className="px-4 py-3">{new Date(ot.date).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-3">{ot.hours} jam</td>
                  <td className="px-4 py-3 text-xs">
                    {ot.startTime && ot.endTime ? `${ot.startTime} – ${ot.endTime}` : "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs max-w-[200px] truncate"
                    title={plainTextFromHtml(ot.description ?? ot.remarks ?? "")}
                  >
                    {plainTextFromHtml(ot.description ?? ot.remarks ?? "") || "-"}
                  </td>
                  <td className="px-4 py-3">{ot.type === "HOLIDAY" ? "Libur ×2" : "Kerja ×1"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[ot.approvalStatus] ?? ""}`}>
                      {STATUS_LABEL[ot.approvalStatus] ?? ot.approvalStatus}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {ot.approvalStatus === "PENDING" && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(ot.id, "APPROVED")} className="text-xs text-green-600 font-medium">Setujui</button>
                          <button onClick={() => handleApprove(ot.id, "REJECTED")} className="text-xs text-red-600 font-medium">Tolak</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
