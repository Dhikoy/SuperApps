"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MONTHS_ID } from "@/lib/period";
import { formatRupiah } from "@/lib/payroll-policy";
import { SlipAdjustmentRows } from "@/components/SlipAdjustmentRows";

type PayrollItem = {
  nik: string;
  name: string;
  company: string | null;
  gajiPokok: number;
  attendance: { hariKerjaAktual: number };
  overtime: { tunjanganLembur: number };
  gajiPeriod: number;
  totalGaji: number;
  penalty?: { amount: number };
  adjustment?: { allowance: number; mealAllowance: number; deduction: number; note: string | null };
};

export function SlipGajiProfil() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [item, setItem] = useState<PayrollItem | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    fetch(`/api/payroll/my?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setItem(data.item ?? null);
        setPeriodLabel(data.periodLabel ?? "");
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [year, month]);

  if (loading) return <p className="text-sm text-slate-500">Memuat slip gaji...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {MONTHS_ID.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-24"
        />
        {item && (
          <button type="button" onClick={() => window.print()} className="btn-secondary text-sm">
            Cetak Slip
          </button>
        )}
      </div>

      {!item || item.gajiPokok === 0 ? (
        <p className="text-sm text-slate-500">Belum ada data gaji untuk periode ini</p>
      ) : (
        <div className="rounded-xl border bg-white p-6 max-w-md print:border-0" id="slip-gaji-profil">
          <div className="text-center border-b pb-4 mb-4">
            <h3 className="font-bold text-lg">SLIP GAJI</h3>
            <p className="text-sm text-slate-500">BCI Group — {periodLabel}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Nama</span><strong>{item.name}</strong></div>
            <div className="flex justify-between"><span>PT</span><span>{item.company}</span></div>
            <div className="flex justify-between"><span>Gaji Pokok</span><span>{formatRupiah(item.gajiPokok)}</span></div>
            <div className="flex justify-between"><span>Hari Kerja Aktual</span><span>{item.attendance.hariKerjaAktual}</span></div>
            <div className="flex justify-between"><span>Gaji Periode</span><span>{formatRupiah(item.gajiPeriod)}</span></div>
            <div className="flex justify-between"><span>Lembur</span><span>{formatRupiah(item.overtime.tunjanganLembur)}</span></div>
            <SlipAdjustmentRows adjustment={item.adjustment} penaltyAmount={item.penalty?.amount ?? 0} />
            <div className="flex justify-between border-t pt-2 font-bold text-base">
              <span>Total Diterima</span>
              <span className="text-[#503200]">{formatRupiah(item.totalGaji)}</span>
            </div>
          </div>
        </div>
      )}

      <Link href="/dashboard/hr/slip-gaji" className="text-xs text-[#503200] hover:underline print:hidden">
        Lihat slip semua karyawan (HR) →
      </Link>
    </div>
  );
}
