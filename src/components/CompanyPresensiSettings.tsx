"use client";

import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/ui";

type Office = { id: string; name: string };
type Schedule = { id: string; shiftName: string; standardClockIn: string; standardClockOut: string };
type CompanyRow = {
  company: string;
  officeLocationId: string | null;
  workScheduleId: string | null;
  workDaysPerMonth: number;
  shiftOptionIds?: string[];
  allowShiftSelection?: boolean;
  officeLocation: { id: string; name: string } | null;
  workSchedule: { id: string; shiftName: string; standardClockIn: string } | null;
  employeeCount: number;
};

export function CompanyPresensiSettings() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/company-presensi")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Gagal memuat");
        setCompanies(data.companies ?? []);
        setOffices(data.offices ?? []);
        setSchedules(data.schedules ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, []);

  async function saveRow(
    company: string,
    officeLocationId: string,
    workScheduleId: string,
    workDaysPerMonth: number,
    shiftOptionIds: string[]
  ) {
    setSaving(company);
    setError("");

    const res = await fetch("/api/settings/company-presensi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        officeLocationId: officeLocationId || null,
        workScheduleId: workScheduleId || null,
        workDaysPerMonth,
        shiftOptionIds,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan");
      setSaving(null);
      return;
    }

    setCompanies((prev) => prev.map((c) => (c.company === company ? { ...c, ...data } : c)));
    setSaving(null);
  }

  if (loading) return <p className="text-sm text-slate-500">Memuat konfigurasi PT...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Satu setting per PT — semua karyawan PT yang sama otomatis pakai kantor dan target hari kerja yang sama.
        Untuk outlet dengan beberapa shift (mis. LBB BCG 1/2/3), centang shift yang boleh dipilih karyawan saat
        clock in. Master shift di{" "}
        <a href="/dashboard/jadwal" className="text-orange-600 font-medium hover:underline">
          Jadwal Kerja
        </a>
        .
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2.5">PT</th>
              <th className="px-3 py-2.5">Karyawan</th>
              <th className="px-3 py-2.5">Lokasi Kantor</th>
              <th className="px-3 py-2.5">Shift Default</th>
              <th className="px-3 py-2.5 min-w-[220px]">Shift Clock-In (pilih 2+)</th>
              <th className="px-3 py-2.5">Hari/Bulan</th>
              <th className="px-3 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((row) => (
              <CompanyRowEditor
                key={row.company}
                row={row}
                offices={offices}
                schedules={schedules}
                saving={saving === row.company}
                onSave={saveRow}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyRowEditor({
  row,
  offices,
  schedules,
  saving,
  onSave,
}: {
  row: CompanyRow;
  offices: Office[];
  schedules: Schedule[];
  saving: boolean;
  onSave: (
    company: string,
    officeId: string,
    scheduleId: string,
    days: number,
    shiftOptionIds: string[]
  ) => void;
}) {
  const [officeId, setOfficeId] = useState(row.officeLocationId ?? "");
  const [scheduleId, setScheduleId] = useState(row.workScheduleId ?? "");
  const [days, setDays] = useState(String(row.workDaysPerMonth ?? 22));
  const [shiftIds, setShiftIds] = useState<string[]>(row.shiftOptionIds ?? []);

  useEffect(() => {
    setOfficeId(row.officeLocationId ?? "");
    setScheduleId(row.workScheduleId ?? "");
    setDays(String(row.workDaysPerMonth ?? 22));
    setShiftIds(row.shiftOptionIds ?? []);
  }, [row.officeLocationId, row.workScheduleId, row.workDaysPerMonth, row.shiftOptionIds]);

  const dirty =
    officeId !== (row.officeLocationId ?? "") ||
    scheduleId !== (row.workScheduleId ?? "") ||
    Number(days) !== row.workDaysPerMonth ||
    JSON.stringify([...shiftIds].sort()) !== JSON.stringify([...(row.shiftOptionIds ?? [])].sort());

  function toggleShift(id: string) {
    setShiftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-3 font-semibold text-slate-900">{row.company}</td>
      <td className="px-3 py-3 text-slate-600">{row.employeeCount}</td>
      <td className="px-3 py-3">
        <select
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
          className={`${INPUT_CLASS} !py-2 text-sm min-w-[140px]`}
        >
          <option value="">— Pilih —</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <select
          value={scheduleId}
          onChange={(e) => setScheduleId(e.target.value)}
          className={`${INPUT_CLASS} !py-2 text-sm min-w-[160px]`}
        >
          <option value="">— Pilih —</option>
          {schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.shiftName} ({s.standardClockIn})
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {schedules.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={shiftIds.includes(s.id)}
                onChange={() => toggleShift(s.id)}
                className="rounded border-slate-300"
              />
              <span>
                {s.shiftName} ({s.standardClockIn})
              </span>
            </label>
          ))}
        </div>
        {shiftIds.length >= 2 && (
          <p className="text-[10px] text-emerald-700 mt-1 font-medium">Karyawan pilih shift saat clock in</p>
        )}
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={1}
          max={31}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className={`${INPUT_CLASS} !py-2 text-sm w-20`}
        />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => onSave(row.company, officeId, scheduleId, Number(days) || 22, shiftIds)}
          className="text-xs font-medium text-orange-600 hover:text-orange-800 disabled:opacity-40"
        >
          {saving ? "..." : "Simpan"}
        </button>
      </td>
    </tr>
  );
}
