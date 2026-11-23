"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { MONTHS_ID } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";
import { SlipAdjustmentRows } from "@/components/SlipAdjustmentRows";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type PayrollItem = {
  nik: string;
  name: string;
  userId: string;
  company: string | null;
  gajiPokok: number;
  attendance: { hariKerjaAktual: number };
  overtime: { tunjanganLembur: number };
  gajiPeriod: number;
  totalGaji: number;
  penalty?: { slipLabel: string | null; warning: string | null; amount: number };
  adjustment?: { allowance: number; mealAllowance: number; deduction: number; note: string | null };
};

export default function SlipGajiPage() {
  const { showToast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [selected, setSelected] = useState<PayrollItem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    void hrFetchJson<{ items: PayrollItem[]; periodLabel: string }>(`/api/payroll?${params}`).then((res) => {
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      setItems(res.data.items ?? []);
      setPeriodLabel(res.data.periodLabel ?? "");
    });
  }, [year, month, showToast]);

  function printSlip() {
    window.print();
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader title="Slip Gaji" subtitle="Slip gaji per karyawan per periode" />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline print:hidden">← Dashboard HR</Link>

      <div className="flex flex-wrap gap-3 print:hidden">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input-field w-auto">
          {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="input-field w-28" />
      </div>

      <p className="text-sm text-slate-500 print:hidden">Periode: {periodLabel}</p>

      <div className="grid sm:grid-cols-2 gap-3 print:hidden">
        {items.map((item) => (
          <button
            key={item.nik}
            onClick={() => setSelected(item)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${selected?.nik === item.nik ? "border-blue-400 bg-blue-50" : "bg-white hover:bg-slate-50"}`}
          >
            <p className="font-medium text-slate-900">{item.name}</p>
            <p className="text-sm text-slate-500">{item.company} · {formatRupiah(item.totalGaji)}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border bg-white p-8 max-w-md mx-auto" id="slip-gaji">
          <div className="text-center border-b pb-4 mb-4">
            <h2 className="text-lg font-bold">SLIP GAJI</h2>
            <p className="text-sm text-slate-500">BCI Group — {periodLabel}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Nama</span><strong>{selected.name}</strong></div>
            <div className="flex justify-between"><span>NIK</span><span>{selected.nik}</span></div>
            <div className="flex justify-between"><span>Perusahaan</span><span>{selected.company}</span></div>
            <div className="flex justify-between"><span>Hari Kerja</span><span>{selected.attendance.hariKerjaAktual}</span></div>
            <hr className="my-3" />
            <div className="flex justify-between"><span>Gaji Pokok</span><span>{formatRupiah(selected.gajiPokok)}</span></div>
            <div className="flex justify-between"><span>Gaji Periode</span><span>{formatRupiah(selected.gajiPeriod)}</span></div>
            <div className="flex justify-between"><span>Tunjangan Lembur</span><span>{formatRupiah(selected.overtime.tunjanganLembur)}</span></div>
            <SlipAdjustmentRows adjustment={selected.adjustment} penaltyAmount={selected.penalty?.amount ?? 0} />
            {selected.penalty?.slipLabel && (
              <p className="text-right text-xs text-slate-500">{selected.penalty.slipLabel}</p>
            )}
            {selected.penalty?.warning && (
              <p className="text-amber-700">{selected.penalty.warning}</p>
            )}
            <hr className="my-3" />
            <div className="flex justify-between text-base font-bold"><span>Total Diterima</span><span className="text-emerald-700">{formatRupiah(selected.totalGaji)}</span></div>
          </div>
          <button onClick={printSlip} className="btn-primary w-full mt-6 print:hidden">Cetak Slip</button>
        </div>
      )}
    </div>
  );
}
