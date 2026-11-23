"use client";

import { useRouter } from "next/navigation";
import { MONTHS_ID } from "@/lib/period";

type Props = {
  year: number;
  month: number;
  basePath: string;
  className?: string;
};

export function PeriodPicker({ year, month, basePath, className }: Props) {
  const router = useRouter();

  function update(m: number, y: number) {
    router.push(`${basePath}?year=${y}&month=${m}`);
  }

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className ?? ""}`}>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Bulan</label>
        <select
          value={month}
          onChange={(e) => update(Number(e.target.value), year)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {MONTHS_ID.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Tahun</label>
        <select
          value={year}
          onChange={(e) => update(month, Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {[2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
