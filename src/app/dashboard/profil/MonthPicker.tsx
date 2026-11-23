"use client";

import { useRouter } from "next/navigation";
import { INPUT_CLASS } from "@/components/ui";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export function MonthPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter();

  function update(m: number, y: number) {
    router.push(`/dashboard/profil?year=${y}&month=${m}`);
  }

  return (
    <div className="flex gap-2">
      <select
        value={month}
        onChange={(e) => update(Number(e.target.value), year)}
        className={`${INPUT_CLASS} !w-auto !py-1.5 !px-3 text-sm`}
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1} className="bg-slate-900">
            {m}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => update(month, Number(e.target.value))}
        className={`${INPUT_CLASS} !w-auto !py-1.5 !px-3 text-sm`}
      >
        {[2025, 2026, 2027].map((y) => (
          <option key={y} value={y} className="bg-slate-900">
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
