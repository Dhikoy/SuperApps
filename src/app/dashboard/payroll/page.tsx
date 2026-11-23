"use client";

import { Fragment, useEffect, useState } from "react";
import { MONTHS_ID } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";
import { CompanySelect } from "@/components/CompanySelect";
import { AccountSelect } from "@/components/accounting/AccountSelect";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";

type PayrollItem = {
  nik: string;
  name: string;
  userId: string;
  company: string | null;
  gajiPokok: number;
  policy: { company: string; standardWorkDays: number; calculationMode: string } | null;
  attendance: { hariKerjaAktual: number; totalHadir: number; totalTerlambat: number };
  overtime: { totalHours: number; tunjanganLembur: number };
  tarifDasar: number;
  gajiPeriod: number;
  totalGaji: number;
  penalty: { points: number; amount: number; warning: string | null; slipLabel: string | null };
  adjustment: Adjustment;
};

type Adjustment = { allowance: number; mealAllowance: number; deduction: number; note: string | null };

const EMPTY_TOTALS = {
  gajiPeriod: 0,
  tunjanganLembur: 0,
  potonganPenalti: 0,
  tunjangan: 0,
  uangMakan: 0,
  potonganLain: 0,
  totalGaji: 0,
};

type Employee = { nik: string; name: string; company: string | null };

export default function PayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [company, setCompany] = useState("");
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [editing, setEditing] = useState<string | null>(null);
  const [adjForm, setAdjForm] = useState({ allowance: "", mealAllowance: "", deduction: "", note: "" });
  const [adjError, setAdjError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [penaltyWarnings, setPenaltyWarnings] = useState<string[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ userId: "", gajiPokok: "" });
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (company) params.set("company", company);

    fetch(`/api/payroll?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotals({ ...EMPTY_TOTALS, ...(data.totals ?? {}) });
        setPenaltyWarnings(Array.isArray(data.penaltyWarnings) ? data.penaltyWarnings : []);
        setPeriodLabel(data.periodLabel ?? "");
      })
      .finally(() => setLoading(false));
  }, [year, month, company, reloadKey]);

  function startEdit(item: PayrollItem) {
    setEditing(item.nik);
    setAdjError("");
    setAdjForm({
      allowance: item.adjustment.allowance ? String(item.adjustment.allowance) : "",
      mealAllowance: item.adjustment.mealAllowance ? String(item.adjustment.mealAllowance) : "",
      deduction: item.adjustment.deduction ? String(item.adjustment.deduction) : "",
      note: item.adjustment.note ?? "",
    });
  }

  async function saveAdjustment(nik: string) {
    setAdjError("");
    const res = await fetch("/api/payroll/adjustments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: nik, year, month, ...adjForm }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAdjError(data.error ?? "Gagal menyimpan");
      return;
    }
    setEditing(null);
    setReloadKey((k) => k + 1);
  }

  async function handleSetSalary(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/payroll/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: salaryForm.userId,
        gajiPokok: Number(salaryForm.gajiPokok),
      }),
    });
    if (res.ok) {
      setSalaryForm({ userId: "", gajiPokok: "" });
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (company) params.set("company", company);
      const data = await fetch(`/api/payroll?${params}`).then((r) => r.json());
      setItems(data.items ?? []);
      setTotals({ ...EMPTY_TOTALS, ...(data.totals ?? {}) });
      setPenaltyWarnings(Array.isArray(data.penaltyWarnings) ? data.penaltyWarnings : []);
    }
  }

  const [postMsg, setPostMsg] = useState("");
  const [postCashAccount, setPostCashAccount] = useState<string>(DEFAULT_ACCOUNTS.cash);
  const [withholding, setWithholding] = useState(false);

  async function handlePostPayroll() {
    const res = await fetch("/api/payroll/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, company: company || "ALL", cashAccount: postCashAccount, withholding }),
    });
    const data = await res.json();
    setPostMsg(data.message ?? data.error ?? "");
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll Presensi</h1>
          <p className="text-slate-500 mt-1">
            Perhitungan gaji BCI (hourly + lembur) dan LBB (daily) — periode cut-off 26 s/d 25
          </p>
          {periodLabel && <p className="text-sm text-orange-600 mt-1 font-medium">{periodLabel}</p>}
          {postMsg && <p className="text-sm text-blue-600 mt-1">{postMsg}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({ year: String(year), month: String(month) });
              if (company) params.set("company", company);
              window.open(`/api/payroll/export?${params}`, "_blank");
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            Export PDF
          </button>
          <AccountSelect
            value={postCashAccount}
            onChange={setPostCashAccount}
            cashOnly
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <label
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-600"
            title="Gaji dibayarkan = gaji − BPJS karyawan − PPh 21 (sesuai data HR); potongan dicatat sebagai utang"
          >
            <input type="checkbox" checked={withholding} onChange={(e) => setWithholding(e.target.checked)} />
            Potong PPh 21 & BPJS karyawan
          </label>
          <button onClick={handlePostPayroll} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            Posting ke Keuangan
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-100">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Periode</label>
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
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Perusahaan</label>
          <CompanySelect
            value={company}
            onChange={setCompany}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            includeAll
            allLabel="Semua"
          />
        </div>
      </div>

      {penaltyWarnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Potongan penalti belum masuk payroll</p>
          <ul className="mt-1 list-disc pl-5">
            {penaltyWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Gaji Pokok Periode</p>
          <p className="text-lg font-bold text-slate-900">{formatRupiah(totals.gajiPeriod)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Tunjangan Lembur</p>
          <p className="text-lg font-bold text-orange-600">{formatRupiah(totals.tunjanganLembur)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Tunjangan + Uang Makan</p>
          <p className="text-lg font-bold text-emerald-600">{formatRupiah(totals.tunjangan + totals.uangMakan)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Potongan (Penalti + Lain)</p>
          <p className="text-lg font-bold text-red-600">{formatRupiah(totals.potonganPenalti + totals.potonganLain)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Grand Total</p>
          <p className="text-lg font-bold text-blue-600">{formatRupiah(totals.totalGaji)}</p>
        </div>
      </div>

      <form
        onSubmit={handleSetSalary}
        className="mb-6 flex flex-wrap gap-3 items-end rounded-xl bg-white p-4 shadow-sm border border-slate-100"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Set Gaji Pokok</label>
          <select
            value={salaryForm.userId}
            onChange={(e) => setSalaryForm({ ...salaryForm, userId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[200px]"
            required
          >
            <option value="">Pilih karyawan</option>
            {employees.map((e) => (
              <option key={e.nik} value={e.nik}>{e.name} ({e.company ?? "-"})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Gaji Pokok (Rp)</label>
          <input
            type="number"
            value={salaryForm.gajiPokok}
            onChange={(e) => setSalaryForm({ ...salaryForm, gajiPokok: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-40"
            required
            min={1}
          />
        </div>
        <button type="submit" className="rounded-lg bg-[#1a2332] px-4 py-2 text-sm font-medium text-white">
          Simpan
        </button>
      </form>

      {loading ? (
        <p className="text-slate-500 text-sm">Menghitung payroll...</p>
      ) : (
        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Karyawan</th>
                <th className="px-6 py-3 font-medium">PT</th>
                <th className="px-6 py-3 font-medium">Mode</th>
                <th className="px-6 py-3 font-medium">Hari Hadir</th>
                <th className="px-6 py-3 font-medium">Gaji Pokok</th>
                <th className="px-6 py-3 font-medium">Gaji Periode</th>
                <th className="px-6 py-3 font-medium">Lembur</th>
                <th className="px-6 py-3 font-medium">Tunjangan</th>
                <th className="px-6 py-3 font-medium">Uang Makan</th>
                <th className="px-6 py-3 font-medium">Potongan Penalti</th>
                <th className="px-6 py-3 font-medium">Potongan Lain</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada data payroll
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item.nik}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{item.name}</td>
                    <td className="px-6 py-4">{item.company ?? "-"}</td>
                    <td className="px-6 py-4">
                      {item.policy?.calculationMode === "HOURLY"
                        ? `${item.company ?? "Office"} (÷173)`
                        : item.policy?.calculationMode === "DAILY"
                          ? "LBB (÷26)"
                          : "-"}
                    </td>
                    <td className="px-6 py-4">{item.attendance.hariKerjaAktual}</td>
                    <td className="px-6 py-4">{item.gajiPokok > 0 ? formatRupiah(item.gajiPokok) : "-"}</td>
                    <td className="px-6 py-4">{formatRupiah(item.gajiPeriod)}</td>
                    <td className="px-6 py-4 text-orange-600">
                      {item.overtime.totalHours > 0
                        ? `${item.overtime.totalHours}j — ${formatRupiah(item.overtime.tunjanganLembur)}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-emerald-700">
                      {item.adjustment.allowance ? formatRupiah(item.adjustment.allowance) : "-"}
                    </td>
                    <td className="px-6 py-4 text-emerald-700">
                      {item.adjustment.mealAllowance ? formatRupiah(item.adjustment.mealAllowance) : "-"}
                    </td>
                    <td className="px-6 py-4 text-red-700">
                      {item.penalty?.slipLabel ?? item.penalty?.warning ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-red-700" title={item.adjustment.note ?? undefined}>
                      {item.adjustment.deduction ? `−${formatRupiah(item.adjustment.deduction)}` : "-"}
                      {item.adjustment.note && <p className="text-xs text-slate-400 max-w-[160px] truncate">{item.adjustment.note}</p>}
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-600">{formatRupiah(item.totalGaji)}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => (editing === item.nik ? setEditing(null) : startEdit(item))}
                        className="text-xs font-medium text-orange-600 hover:underline"
                      >
                        {editing === item.nik ? "Tutup" : "Ubah"}
                      </button>
                    </td>
                  </tr>
                  {editing === item.nik && (
                    <tr className="bg-orange-50/50">
                      <td colSpan={13} className="px-6 py-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveAdjustment(item.nik);
                          }}
                          className="flex flex-wrap items-end gap-3"
                        >
                          <p className="w-full text-xs text-slate-500">
                            Komponen gaji {item.name} untuk periode {periodLabel} (kosongkan = 0)
                          </p>
                          {([
                            ["allowance", "Insentif / Tunjangan (Rp)"],
                            ["mealAllowance", "Uang Makan (Rp)"],
                            ["deduction", "Potongan / Kasbon (Rp)"],
                          ] as const).map(([key, label]) => (
                            <div key={key}>
                              <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                              <input
                                type="number"
                                min={0}
                                value={adjForm[key]}
                                onChange={(e) => setAdjForm({ ...adjForm, [key]: e.target.value })}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-40"
                              />
                            </div>
                          ))}
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Keterangan</label>
                            <input
                              type="text"
                              value={adjForm.note}
                              onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })}
                              placeholder="Contoh: cicilan kasbon 2/5, insentif proyek"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full"
                            />
                          </div>
                          <button type="submit" className="rounded-lg bg-[#1a2332] px-4 py-2 text-sm font-medium text-white">
                            Simpan
                          </button>
                          {adjError && <p className="w-full text-sm text-red-600">{adjError}</p>}
                        </form>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
