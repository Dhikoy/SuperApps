"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";
import {
  DataTablePagination,
  DataTableShell,
  DataTableToolbar,
  useDataTable,
} from "@/components/ui/DataTableControls";

type Correction = {
  id: string;
  date: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
  approvalStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { nik: string; name: string; company: string | null; userId: string };
  attendance: { clockInTime: string | null; clockOutTime: string | null; status: string } | null;
};

export default function KoreksiAbsensiPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("PENDING");

  async function load() {
    setLoading(true);
    const q = filterStatus ? `?status=${filterStatus}` : "";
    const res = await hrFetchJson<{ items: Correction[] }>(`/api/hr/attendance-corrections${q}`);
    if (!res.ok) {
      showToast(res.error, "error");
      setItems([]);
    } else {
      setItems(res.data.items ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filterStatus]);

  const filterFn = useMemo(
    () => (row: Correction, q: string) => {
      return (
        row.user.name.toLowerCase().includes(q) ||
        row.user.nik.toLowerCase().includes(q) ||
        (row.user.company ?? "").toLowerCase().includes(q) ||
        row.reason.toLowerCase().includes(q)
      );
    },
    []
  );

  const table = useDataTable(items, filterFn, 10);

  async function review(id: string, action: "approve" | "reject") {
    const res = await hrFetchJson("/api/hr/attendance-corrections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast(action === "approve" ? "Koreksi disetujui" : "Koreksi ditolak", "success");
    load();
  }

  return (
    <div className="space-y-6 p-6 sm:p-8 max-w-6xl">
      <PageHeader
        title="Koreksi Absensi"
        subtitle="Persetujuan koreksi jam masuk/pulang dari karyawan (web & Telegram)"
        badge={
          filterStatus === "PENDING"
            ? `${items.length} pending`
            : `${items.length} data`
        }
      />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">
        ← Dashboard HR
      </Link>

      <DataTableShell>
        <DataTableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Cari nama, NIK, alasan..."
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          filters={
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                table.setPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-slate-700"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
              <option value="">Semua</option>
            </select>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Karyawan</th>
                <th className="px-4 py-2.5 font-semibold">Tanggal</th>
                <th className="px-4 py-2.5 font-semibold">Sebelum</th>
                <th className="px-4 py-2.5 font-semibold">Diminta</th>
                <th className="px-4 py-2.5 font-semibold">Alasan</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold w-28"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Memuat...
                  </td>
                </tr>
              ) : table.pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                table.pageRows.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
                    <td className="px-4 py-2.5 border-t border-slate-100">
                      <p className="font-medium">{row.user.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.user.company ?? "—"} · {row.user.nik}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 border-t border-slate-100 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-2.5 border-t border-slate-100 text-xs">
                      <div>In: {row.attendance?.clockInTime ?? "—"}</div>
                      <div>Out: {row.attendance?.clockOutTime ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 border-t border-slate-100 text-xs font-medium">
                      <div>In: {row.requestedClockIn ?? "(tetap)"}</div>
                      <div>Out: {row.requestedClockOut ?? "(tetap)"}</div>
                    </td>
                    <td className="px-4 py-2.5 border-t border-slate-100 max-w-[220px]">
                      <p className="line-clamp-3" title={row.reason}>
                        {row.reason}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 border-t border-slate-100">
                      <StatusBadge status={row.approvalStatus} />
                    </td>
                    <td className="px-4 py-2.5 border-t border-slate-100 space-x-2 whitespace-nowrap">
                      {row.approvalStatus === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() => review(row.id, "approve")}
                            className="text-xs text-emerald-600 font-medium"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => review(row.id, "reject")}
                            className="text-xs text-red-600 font-medium"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DataTablePagination
          rangeStart={table.rangeStart}
          rangeEnd={table.rangeEnd}
          totalItems={table.totalItems}
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          onPageChange={table.setPage}
        />
      </DataTableShell>
    </div>
  );
}
