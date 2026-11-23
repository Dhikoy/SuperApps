"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CompanySelect } from "@/components/CompanySelect";
import { useToast } from "@/components/ToastProvider";
import { MONTHS_ID } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";

type SummaryRow = {
  nik: string;
  name: string;
  department: string | null;
  incidents: number;
  totalPoints: number;
  ratePerPoint: number | null;
  deduction: number | null;
};

type Summary = {
  needsCompany: boolean;
  company: string | null;
  canSwitchCompany: boolean;
  canUnlock: boolean;
  period: string;
  status: "open" | "locked";
  ratePerPoint: number | null;
  previousRate: number | null;
  rows: SummaryRow[];
};

type Detail = {
  employee: { nik: string; name: string; department: string | null; company: string };
  totalPoints: number;
  incidents: number;
  deduction: number | null;
  ratePerPoint: number | null;
  entries: { id: string; date: string; points: number; note: string; createdByName: string }[];
};

function moneyOrPending(value: number | null) {
  return value == null ? "Belum ditentukan" : formatRupiah(value);
}

export default function RekapPenaltiPage() {
  const { showToast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [company, setCompany] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState("");
  const [usePrevious, setUsePrevious] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [reason, setReason] = useState("");

  const period = `${year}-${String(month).padStart(2, "0")}`;

  function load() {
    const params = new URLSearchParams({ period });
    if (company) params.set("company", company);
    fetch(`/api/penalties/summary?${params}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          showToast(typeof data.error === "string" ? data.error : "Gagal memuat rekap", "error");
          setSummary(null);
          return;
        }
        setSummary(data);
        if (data.company && !company) setCompany(data.company);
      })
      .catch(() => showToast("Gagal memuat rekap", "error"));
  }

  useEffect(() => {
    load();
    setDetail(null);
    // company is included so a switch reloads; empty company still loads the actor's company
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, company]);

  async function openDetail(nik: string) {
    const params = new URLSearchParams({ period });
    const res = await fetch(`/api/penalties/employee/${nik}?${params}`);
    const data = await res.json();
    if (!res.ok) {
      showToast(typeof data.error === "string" ? data.error : "Gagal membuka detail", "error");
      return;
    }
    setDetail(data);
  }

  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/penalty-periods/${period}/rate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: summary?.company,
        usePrevious,
        ratePerPoint: usePrevious ? undefined : Number(rateValue),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(typeof data.error === "string" ? data.error : "Gagal menyimpan rate", "error");
      return;
    }
    showToast("Rate penalti disimpan", "success");
    setRateOpen(false);
    setUsePrevious(false);
    load();
  }

  async function lockPeriod() {
    if (!confirm("Kunci periode ini? Penalti bulan ini tidak bisa diubah lagi.")) return;
    const res = await fetch(`/api/penalty-periods/${period}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: summary?.company }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(typeof data.error === "string" ? data.error : "Gagal mengunci", "error");
      return;
    }
    showToast("Periode dikunci", "success");
    load();
  }

  async function unlockPeriod(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/penalty-periods/${period}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: summary?.company, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(typeof data.error === "string" ? data.error : "Gagal membuka kunci", "error");
      return;
    }
    showToast("Kunci periode dibuka", "success");
    setUnlockOpen(false);
    setReason("");
    load();
  }

  const locked = summary?.status === "locked";
  const rateReady = summary?.ratePerPoint != null;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rekap Penalti</h1>
          <p className="mt-1 text-sm text-slate-500">
            Poin harian dikonversi ke rupiah setelah rate bulan ini diisi dan periode dikunci.
          </p>
          <p className="text-xs font-medium text-[#503200]">
            <Link href="/dashboard/presensi/harian" className="hover:underline">
              Input poin di Rekap Harian
            </Link>
            {" · "}
            <Link href="/dashboard/hr/panduan#penalti" className="hover:underline">
              Tata cara untuk HRD
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!summary?.company}
            onClick={() => {
              const params = new URLSearchParams();
              if (summary?.company) params.set("company", summary.company);
              window.open(`/api/penalty-periods/${period}/export?${params}`, "_blank");
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Export Excel
          </button>
          <button
            type="button"
            disabled={!summary?.company || !rateReady || locked}
            onClick={lockPeriod}
            className="rounded-lg bg-[#503200] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Kunci Periode
          </button>
          {locked && summary?.canUnlock && (
            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"
            >
              Buka Kunci
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium text-slate-500">
          Bulan
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {MONTHS_ID.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Tahun
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {[2025, 2026, 2027].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {summary?.canSwitchCompany && (
          <label className="text-xs font-medium text-slate-500">
            Perusahaan
            <CompanySelect
              value={company}
              onChange={setCompany}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rate bulan ini</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {summary?.needsCompany
              ? "Pilih perusahaan"
              : summary?.ratePerPoint == null
                ? "Belum ditentukan"
                : `${formatRupiah(summary.ratePerPoint)} / poin`}
          </p>
          <p className="text-xs text-slate-500">
            {locked ? "Periode terkunci" : "Periode terbuka"}
            {summary?.company ? ` · ${summary.company}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={!summary?.company || locked}
          onClick={() => {
            setRateValue(summary?.ratePerPoint == null ? "" : String(summary.ratePerPoint));
            setUsePrevious(false);
            setRateOpen(true);
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {rateReady ? "Ubah Rate" : "Set Rate"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">NIK</th>
              <th className="px-4 py-3 font-semibold">Divisi</th>
              <th className="px-4 py-3 font-semibold">Jumlah kejadian</th>
              <th className="px-4 py-3 font-semibold">Total poin</th>
              <th className="px-4 py-3 font-semibold">Rate/poin</th>
              <th className="px-4 py-3 font-semibold">Total potongan</th>
            </tr>
          </thead>
          <tbody>
            {!summary || summary.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {summary?.needsCompany ? "Pilih perusahaan dulu" : "Belum ada penalti di bulan ini"}
                </td>
              </tr>
            ) : (
              summary.rows.map((row) => (
                <tr
                  key={row.nik}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => openDetail(row.nik)}
                >
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.nik}</td>
                  <td className="px-4 py-3">{row.department ?? "-"}</td>
                  <td className="px-4 py-3">{row.incidents}</td>
                  <td className="px-4 py-3">{row.totalPoints}</td>
                  <td className="px-4 py-3">{moneyOrPending(row.ratePerPoint)}</td>
                  <td className="px-4 py-3">{moneyOrPending(row.deduction)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">{detail.employee.name}</h2>
              <p className="text-xs text-slate-500">
                {detail.employee.nik} · {detail.employee.department ?? "-"} · {detail.incidents} kejadian ·{" "}
                {detail.totalPoints} poin · {moneyOrPending(detail.deduction)}
              </p>
            </div>
            <button type="button" onClick={() => setDetail(null)} className="text-sm text-slate-500">
              Tutup
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {detail.entries.map((entry) => (
              <li key={entry.id} className="py-2 text-sm">
                <p className="font-medium text-slate-800">
                  {entry.date} · {entry.points} poin
                </p>
                <p className="text-slate-600">{entry.note}</p>
                <p className="text-xs text-slate-400">{entry.createdByName}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveRate} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5">
            <h3 className="text-base font-semibold">Nilai per 1 poin</h3>
            <input
              type="number"
              min={0}
              step="1"
              value={rateValue}
              disabled={usePrevious}
              onChange={(e) => setRateValue(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder="10000"
              required={!usePrevious}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={usePrevious}
                onChange={(e) => setUsePrevious(e.target.checked)}
              />
              Gunakan rate bulan lalu
              {summary?.previousRate != null ? ` (${formatRupiah(summary.previousRate)})` : " (belum ada)"}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRateOpen(false)} className="px-3 py-2 text-sm">
                Batal
              </button>
              <button type="submit" className="btn-primary">
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {unlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={unlockPeriod} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5">
            <h3 className="text-base font-semibold">Buka kunci periode</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="Alasan wajib"
              required
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setUnlockOpen(false)} className="px-3 py-2 text-sm">
                Batal
              </button>
              <button type="submit" className="btn-primary">
                Buka kunci
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
