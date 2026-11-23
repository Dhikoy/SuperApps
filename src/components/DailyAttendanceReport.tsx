"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PenaltyModals, usePenaltyDay } from "@/components/PenaltyDailyTools";

type DailyRow = {
  nik: string;
  name: string;
  department: string | null;
  company: string | null;
  status: string;
  leaveType: string | null;
  clockInTime: string | null;
  clockOutTime: string | null;
};

const PAGE_SIZES = [10, 25, 50, 100];

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function formatTableDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${y}-${m}-${d}`;
}

function formatClock(time: string | null) {
  if (!time) return null;
  return time.slice(0, 5);
}

/** Tampilkan izin/cuti, atau jam clock-in/out aktual — bukan jam shift. */
function izinOrClockIn(row: DailyRow) {
  if (row.leaveType) return row.leaveType;
  if (row.status === "IZIN") return "Izin";
  if (row.status === "ALPHA") return "Alpha";

  const masuk = formatClock(row.clockInTime);
  const keluar = formatClock(row.clockOutTime);
  if (masuk && keluar) return `${masuk} - ${keluar}`;
  if (masuk) return masuk;
  return "-";
}

function compareClockIn(a: DailyRow, b: DailyRow, dir: "asc" | "desc") {
  const timeA = a.clockInTime ?? "";
  const timeB = b.clockInTime ?? "";
  if (timeA && timeB) {
    const cmp = timeA.localeCompare(timeB);
    return dir === "asc" ? cmp : -cmp;
  }
  if (timeA) return dir === "asc" ? -1 : 1;
  if (timeB) return dir === "asc" ? 1 : -1;
  const cmp = izinOrClockIn(a).localeCompare(izinOrClockIn(b), "id");
  return dir === "asc" ? cmp : -cmp;
}

export function DailyAttendanceReport() {
  const [date, setDate] = useState(todayInputValue);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [jamSort, setJamSort] = useState<"asc" | "desc" | null>(null);
  const penalty = usePenaltyDay(date);
  const colSpan = penalty.enabled ? 5 : 4;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance/daily?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows ?? []);
        setPage(1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [date]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const div = row.department ?? row.company ?? "";
      return (
        row.nik.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        div.toLowerCase().includes(q) ||
        (row.leaveType ?? "").toLowerCase().includes(q) ||
        (row.clockInTime ?? "").includes(q) ||
        izinOrClockIn(row).toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (!jamSort) return filtered;
    return [...filtered].sort((a, b) => compareClockIn(a, b, jamSort));
  }, [filtered, jamSort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, sorted.length);

  function toggleJamSort() {
    setJamSort((prev) => {
      if (prev === null) return "asc";
      if (prev === "asc") return "desc";
      return null;
    });
    setPage(1);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Absensi Harian {formatTableDate(date)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Daftar karyawan per hari</p>
          {penalty.enabled && (
            <Link href="/dashboard/presensi/penalti" className="text-xs font-medium text-[#503200] hover:underline">
              Rekap penalti bulanan
            </Link>
          )}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>entries</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-slate-600">Search:</label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-1 min-w-[180px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
              <th className="px-4 py-2.5 font-semibold border-r border-slate-200">NIK</th>
              <th className="px-4 py-2.5 font-semibold border-r border-slate-200">Nama</th>
              <th className="px-4 py-2.5 font-semibold border-r border-slate-200">Div</th>
              <th className="px-4 py-2.5 font-semibold">
                <button
                  type="button"
                  onClick={toggleJamSort}
                  className="inline-flex items-center gap-1.5 hover:text-[#503200] transition-colors"
                  title={
                    jamSort === "asc"
                      ? "Urut A→Z (klik untuk Z→A)"
                      : jamSort === "desc"
                        ? "Urut Z→A (klik untuk reset)"
                        : "Klik untuk urut A→Z"
                  }
                >
                  Izin / Jam Masuk
                  <span className="inline-flex flex-col text-[10px] leading-none text-slate-400">
                    <span className={jamSort === "asc" ? "text-[#503200] font-bold" : ""}>▲</span>
                    <span className={jamSort === "desc" ? "text-[#503200] font-bold" : ""}>▼</span>
                  </span>
                </button>
              </th>
              {penalty.enabled && (
                <th className="px-4 py-2.5 font-semibold border-l border-slate-200">Penalti</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
                  Memuat data...
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={row.nik}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                >
                  <td className="px-4 py-2 border-t border-slate-200 border-r font-mono text-xs">
                    {row.nik}
                  </td>
                  <td className="px-4 py-2 border-t border-slate-200 border-r">{row.name}</td>
                  <td className="px-4 py-2 border-t border-slate-200 border-r">
                    {row.department ?? row.company ?? "-"}
                  </td>
                  <td className="px-4 py-2 border-t border-slate-200 text-slate-600">
                    <span
                      className={
                        row.status === "TERLAMBAT"
                          ? "text-amber-700 font-medium"
                          : row.status === "ALPHA"
                            ? "text-red-600"
                            : ""
                      }
                    >
                      {izinOrClockIn(row)}
                    </span>
                  </td>
                  {penalty.enabled && (
                    <td className="px-4 py-2 border-t border-l border-slate-200">
                      <div className="flex items-center gap-2">
                        {(penalty.byNik.get(row.nik)?.total ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => penalty.openList(row)}
                            className="text-sm font-semibold text-[#503200] hover:underline"
                          >
                            {penalty.byNik.get(row.nik)?.total} poin
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                        <button
                          type="button"
                          disabled={penalty.isLocked(row.company)}
                          onClick={() => penalty.openAdd(row)}
                          title={penalty.isLocked(row.company) ? "Periode dikunci" : "Tambah penalti"}
                          className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          + Penalti
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
        <p>
          Showing {rangeStart} to {rangeEnd} of {sorted.length} entries
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev != null && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-1">
                  {showEllipsis && <span className="px-1">…</span>}
                  <button
                    type="button"
                    onClick={() => setPage(p)}
                    className={`min-w-[2rem] rounded border px-2 py-1 ${
                      p === currentPage
                        ? "border-[#503200] bg-[#503200] text-white"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>
      {penalty.enabled && <PenaltyModals {...penalty} date={date} />}
    </div>
  );
}
