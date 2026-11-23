"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { getCalendarMonthForDate, MONTHS_ID } from "@/lib/period";
import { PresensiTable } from "@/components/PresensiTable";

type Employee = { nik: string; name: string; userId: string; role: string };
type Summary = {
  nik: string;
  name: string;
  userId: string;
  role: string;
  totalHadir: number;
  totalTerlambat: number;
  totalIzin: number;
  totalAlpha: number;
  totalMasuk: number;
};
type Attendance = {
  id: string;
  date: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  status: string;
  selfieImage: string | null;
  clockOutSelfieImage: string | null;
  user: { name: string; userId: string };
  jamKerja: { shiftName: string } | null;
};

type Review = {
  confirmedCause: string | null;
  notes: string | null;
  followUp: string | null;
  status: "BELUM_DIKONFIRMASI" | "DIPANTAU" | "SELESAI";
};
type AnalysisRow = {
  nik: string;
  name: string;
  company: string | null;
  requiredDays: number;
  clockInDays: number;
  completeDays: number;
  noClockInDays: number;
  missingClockOutDays: number;
  clockInPhotoCount: number;
  clockOutPhotoCount: number;
  compliancePercentage: number;
  indications: string[];
  risk: "TINGGI" | "SEDANG" | "RENDAH";
  review: Review | null;
};
type AnalysisResponse = {
  period: string;
  periodLabel: string;
  summary: {
    highRisk: number;
    mediumRisk: number;
    neverClockedIn: number;
    oftenMissingClockOut: number;
  };
  rows: AnalysisRow[];
};

function AnalysisReviewEditor({
  row,
  period,
  onSaved,
}: {
  row: AnalysisRow;
  period: string;
  onSaved: () => void;
}) {
  const [cause, setCause] = useState(row.review?.confirmedCause ?? "");
  const [followUp, setFollowUp] = useState(row.review?.followUp ?? "");
  const [status, setStatus] = useState<Review["status"]>(
    row.review?.status ?? "BELUM_DIKONFIRMASI"
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/attendance/analysis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          userId: row.nik,
          confirmedCause: cause,
          followUp,
          status,
        }),
      });
      if (!response.ok) throw new Error("Gagal menyimpan review");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[230px] space-y-2">
      <input
        value={cause}
        onChange={(event) => setCause(event.target.value)}
        placeholder="Penyebab terkonfirmasi"
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
      />
      <input
        value={followUp}
        onChange={(event) => setFollowUp(event.target.value)}
        placeholder="Tindak lanjut"
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Review["status"])}
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="BELUM_DIKONFIRMASI">Belum dikonfirmasi</option>
          <option value="DIPANTAU">Dipantau</option>
          <option value="SELESAI">Selesai</option>
        </select>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded bg-[#1a2332] px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {saving ? "..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

export default function LaporanPresensiPage() {
  const calendarDefault = getCalendarMonthForDate();
  const [year, setYear] = useState(calendarDefault.year);
  const [month, setMonth] = useState(calendarDefault.month);
  const [userId, setUserId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"report" | "analysis">("report");
  const [company, setCompany] = useState("");
  const [risk, setRisk] = useState("");
  const [companies, setCompanies] = useState<{ code: string; name: string }[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisVersion, setAnalysisVersion] = useState(0);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => {});
    fetch("/api/companies")
      .then((response) => response.json())
      .then(setCompanies)
      .catch(() => {});
  }, []);

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (userId) params.set("userId", userId);

    fetch(`/api/attendance/report?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary ?? []);
        setAttendances(data.attendances ?? []);
        setPeriodLabel(data.periodLabel ?? "");
      })
      .finally(() => setLoading(false));
  }, [year, month, userId]);

  useEffect(() => {
    if (tab !== "analysis") return;
    queueMicrotask(() => setAnalysisLoading(true));
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (company) params.set("company", company);
    fetch(`/api/attendance/analysis?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error("Gagal memuat analisis");
        return response.json();
      })
      .then(setAnalysis)
      .finally(() => setAnalysisLoading(false));
  }, [year, month, company, tab, analysisVersion]);

  function handleExport(format: "csv" | "pdf") {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      format,
    });
    if (tab === "analysis") {
      params.set("view", "analysis");
      if (company) params.set("company", company);
    } else if (userId) {
      params.set("userId", userId);
    }
    window.open(`/api/attendance/report?${params}`, "_blank");
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan Presensi</h1>
          <p className="text-slate-500 mt-1">Laporan absensi karyawan — HRD</p>
          {periodLabel && <p className="text-sm text-[#503200] mt-1 font-medium">{periodLabel}</p>}
          <p className="text-xs text-slate-400 mt-2 max-w-lg">
            Bulan kalender: tanggal 1 sampai akhir bulan yang dipilih (sampai hari ini).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="rounded-lg bg-[#1a2332] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#243044]"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("report")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "report"
              ? "border-b-2 border-[#503200] text-[#503200]"
              : "text-slate-500"
          }`}
        >
          Laporan Presensi
        </button>
        <button
          onClick={() => setTab("analysis")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "analysis"
              ? "border-b-2 border-[#503200] text-[#503200]"
              : "text-slate-500"
          }`}
        >
          Analisa Permasalahan
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-100">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Bulan</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {MONTHS_ID.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tahun</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {tab === "report" ? (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Karyawan</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">Semua karyawan</option>
              {employees.map((e) => (
                <option key={e.nik} value={e.nik}>{e.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PT</label>
              <select
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[180px]"
              >
                <option value="">Semua PT</option>
                {companies.map((item) => (
                  <option key={item.code} value={item.code}>{item.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tingkat masalah</label>
              <select
                value={risk}
                onChange={(event) => setRisk(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Semua tingkat</option>
                <option value="TINGGI">Tinggi</option>
                <option value="SEDANG">Sedang</option>
                <option value="RENDAH">Rendah</option>
              </select>
            </div>
          </>
        )}
      </div>

      {tab === "analysis" ? (
        analysisLoading || !analysis ? (
          <p className="text-slate-500 text-sm">Memuat analisis...</p>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Risiko tinggi", analysis.summary.highRisk, "text-red-700"],
                ["Risiko sedang", analysis.summary.mediumRisk, "text-amber-700"],
                ["Belum pernah absen", analysis.summary.neverClockedIn, "text-red-700"],
                ["Sering tidak clock-out", analysis.summary.oftenMissingClockOut, "text-orange-700"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="font-semibold">Analisa Permasalahan</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Indikasi otomatis berasal dari data; penyebab HR harus dikonfirmasi. Foto wajah tidak ditampilkan.
                </p>
              </div>
              <table className="min-w-[1700px] w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Karyawan / PT</th>
                    <th className="px-3 py-3">Wajib</th>
                    <th className="px-3 py-3">Masuk</th>
                    <th className="px-3 py-3">Lengkap</th>
                    <th className="px-3 py-3">Alpha</th>
                    <th className="px-3 py-3">Lupa pulang</th>
                    <th className="px-3 py-3">Foto in/out</th>
                    <th className="px-3 py-3">Kepatuhan</th>
                    <th className="px-3 py-3">Indikasi otomatis</th>
                    <th className="px-3 py-3">Konfirmasi HR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.rows
                    .filter((row) => !risk || row.risk === risk)
                    .map((row) => (
                      <tr key={row.nik} className="align-top hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="text-slate-500">{row.company ?? "PT belum diisi"}</p>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 font-semibold ${
                            row.risk === "TINGGI"
                              ? "bg-red-100 text-red-700"
                              : row.risk === "SEDANG"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }`}>
                            {row.risk}
                          </span>
                        </td>
                        <td className="px-3 py-3">{row.requiredDays}</td>
                        <td className="px-3 py-3">{row.clockInDays}</td>
                        <td className="px-3 py-3">{row.completeDays}</td>
                        <td className="px-3 py-3 text-red-600">{row.noClockInDays}</td>
                        <td className="px-3 py-3 text-orange-600">{row.missingClockOutDays}</td>
                        <td className="px-3 py-3">
                          {row.clockInPhotoCount}/{row.clockInDays} · {row.clockOutPhotoCount}/{row.completeDays}
                        </td>
                        <td className="px-3 py-3 font-semibold">{row.compliancePercentage}%</td>
                        <td className="max-w-[260px] px-3 py-3">
                          {row.indications.length ? row.indications.join("; ") : "Tidak ada indikasi"}
                        </td>
                        <td className="px-3 py-3">
                          <AnalysisReviewEditor
                            row={row}
                            period={analysis.period}
                            onSaved={() => setAnalysisVersion((value) => value + 1)}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : loading ? (
        <p className="text-slate-500 text-sm">Memuat laporan...</p>
      ) : (
        <>
          <div className="mb-8 rounded-xl bg-white shadow-sm border border-slate-100 overflow-x-auto overscroll-x-contain">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold">Ringkasan Periode</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total masuk = hari dengan clock in nyata (bukan izin/alpha)
              </p>
            </div>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-medium">Karyawan</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Total Masuk</th>
                  <th className="px-6 py-3 font-medium">Hadir</th>
                  <th className="px-6 py-3 font-medium">Terlambat</th>
                  <th className="px-6 py-3 font-medium">Izin</th>
                  <th className="px-6 py-3 font-medium">Alpha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.map((s) => (
                  <tr key={s.nik} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                    <td className="px-6 py-4 text-slate-600">{ROLE_LABELS[s.role as Role] ?? s.role}</td>
                    <td className="px-6 py-4 font-bold text-blue-600">{s.totalMasuk}</td>
                    <td className="px-6 py-4 text-green-600">{s.totalHadir}</td>
                    <td className="px-6 py-4 text-orange-600">{s.totalTerlambat}</td>
                    <td className="px-6 py-4 text-blue-600">{s.totalIzin ?? 0}</td>
                    <td className="px-6 py-4 text-red-600">{s.totalAlpha ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold">Detail Presensi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik header <strong>Clock In</strong> untuk urut jam terawal (↑) atau terakhir (↓)
              </p>
            </div>
            <PresensiTable
              rows={attendances.map((att) => ({
                id: att.id,
                date: att.date,
                clockInTime: att.clockInTime,
                clockOutTime: att.clockOutTime,
                status: att.status,
                selfieImage: att.selfieImage,
                clockOutSelfieImage: att.clockOutSelfieImage,
                latitude: null,
                longitude: null,
                user: { name: att.user.name },
                jamKerja: att.jamKerja
                  ? { shiftName: att.jamKerja.shiftName, standardClockIn: "" }
                  : null,
              }))}
              showLocation={false}
              embedded
            />
          </div>
        </>
      )}
    </div>
  );
}
