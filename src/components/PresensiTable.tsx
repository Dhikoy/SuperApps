"use client";

import { useMemo, useState } from "react";
import { timeToMinutes } from "@/lib/attendance-time";
import { StatusBadge } from "@/components/ui";
import { SelfieViewer } from "@/components/SelfieViewer";

export type PresensiRow = {
  id: string;
  date: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  status: string;
  selfieImage: string | null;
  clockOutSelfieImage: string | null;
  latitude: number | null;
  longitude: number | null;
  user: { name: string };
  jamKerja: { shiftName: string; standardClockIn: string } | null;
};

type ClockSort = "asc" | "desc" | null;

function sortRows(rows: PresensiRow[], clockSort: ClockSort) {
  return [...rows].sort((a, b) => {
    const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCmp !== 0) return dateCmp;

    if (!clockSort) {
      const nameCmp = a.user.name.localeCompare(b.user.name, "id");
      if (nameCmp !== 0) return nameCmp;
      return (a.clockInTime ?? "").localeCompare(b.clockInTime ?? "");
    }

    const empty = clockSort === "asc" ? 99999 : -1;
    const ma = a.clockInTime ? timeToMinutes(a.clockInTime) : empty;
    const mb = b.clockInTime ? timeToMinutes(b.clockInTime) : empty;
    return clockSort === "asc" ? ma - mb : mb - ma;
  });
}

function ClockInSortHeader({
  order,
  onToggle,
}: {
  order: ClockSort;
  onToggle: () => void;
}) {
  const hint =
    order === "asc"
      ? "Urut jam terawal dulu — klik untuk terakhir dulu"
      : order === "desc"
        ? "Urut jam terakhir dulu — klik untuk urut tanggal"
        : "Urut tanggal terbaru — klik untuk urut jam masuk";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={hint}
      className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wide hover:text-gray-900 transition-colors group"
    >
      Clock In
      <span
        className={`inline-flex flex-col text-[9px] leading-none ${order ? "text-[#503200]" : "text-gray-400"}`}
        aria-hidden
      >
        <span className={order === "asc" ? "opacity-100" : "opacity-40"}>▲</span>
        <span className={order === "desc" ? "opacity-100" : "opacity-40"}>▼</span>
      </span>
    </button>
  );
}

export function PresensiTable({
  rows,
  showEmployee = true,
  showLocation = true,
  embedded = false,
}: {
  rows: PresensiRow[];
  showEmployee?: boolean;
  showLocation?: boolean;
  embedded?: boolean;
}) {
  const [clockSort, setClockSort] = useState<ClockSort>(null);

  const sorted = useMemo(() => sortRows(rows, clockSort), [rows, clockSort]);
  const colCount = (showEmployee ? 1 : 0) + 7 + (showLocation ? 1 : 0);

  function toggleClockSort() {
    setClockSort((s) => (s === null ? "asc" : s === "asc" ? "desc" : null));
  }

  return (
    <div
      className={
        embedded
          ? "overflow-x-auto overscroll-x-contain"
          : "rounded-xl bg-white shadow-sm border border-gray-100 overflow-x-auto overscroll-x-contain"
      }
    >
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            {showEmployee && <th className="px-6 py-3 font-medium">Karyawan</th>}
            <th className="px-6 py-3 font-medium">Tanggal</th>
            <th className="px-6 py-3">
              <ClockInSortHeader order={clockSort} onToggle={toggleClockSort} />
            </th>
            <th className="px-6 py-3 font-medium">Clock Out</th>
            <th className="px-6 py-3 font-medium">Shift</th>
            <th className="px-6 py-3 font-medium">Selfie In</th>
            <th className="px-6 py-3 font-medium">Selfie Out</th>
            {showLocation && <th className="px-6 py-3 font-medium">Lokasi</th>}
            <th className="px-6 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-6 py-8 text-center text-gray-500">
                Belum ada data presensi
              </td>
            </tr>
          ) : (
            sorted.map((att) => (
              <tr key={att.id} className="hover:bg-gray-50">
                {showEmployee && (
                  <td className="px-6 py-4 font-medium text-gray-900">{att.user.name}</td>
                )}
                <td className="px-6 py-4 text-gray-600">
                  {new Date(att.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                </td>
                <td className="px-6 py-4 text-gray-600 font-mono text-xs">{att.clockInTime ?? "-"}</td>
                <td className="px-6 py-4 text-gray-600 font-mono text-xs">{att.clockOutTime ?? "-"}</td>
                <td className="px-6 py-4 text-gray-600">
                  {att.jamKerja
                    ? `${att.jamKerja.shiftName} (${att.jamKerja.standardClockIn})`
                    : "-"}
                </td>
                <td className="px-6 py-4">
                  {att.selfieImage ? (
                    <SelfieViewer src={att.selfieImage} alt={`Selfie masuk ${att.user.name}`} />
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {att.clockOutSelfieImage ? (
                    <SelfieViewer src={att.clockOutSelfieImage} alt={`Selfie pulang ${att.user.name}`} />
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                {showLocation && (
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {att.latitude != null && att.longitude != null
                      ? `${att.latitude.toFixed(4)}, ${att.longitude.toFixed(4)}`
                      : "-"}
                  </td>
                )}
                <td className="px-6 py-4">
                  <StatusBadge status={att.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
