"use client";

import { useMemo, useState, type ReactNode } from "react";

const PAGE_SIZES = [10, 25, 50, 100];

type DataTableControlsProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  page: number;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  filters?: ReactNode;
  actions?: ReactNode;
};

export function useDataTable<T>(
  rows: T[],
  filterFn: (row: T, query: string) => boolean,
  initialPageSize = 10
) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => filterFn(row, q));
  }, [rows, search, filterFn]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  function setSearchAndReset(value: string) {
    setSearch(value);
    setPage(1);
  }

  function setPageSizeAndReset(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return {
    search,
    setSearch: setSearchAndReset,
    pageSize,
    setPageSize: setPageSizeAndReset,
    page,
    setPage,
    filtered,
    pageRows,
    totalPages,
    currentPage,
    rangeStart,
    rangeEnd,
    totalItems: filtered.length,
  };
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Cari...",
  pageSize,
  onPageSizeChange,
  filters,
  actions,
}: Pick<
  DataTableControlsProps,
  "search" | "onSearchChange" | "searchPlaceholder" | "pageSize" | "onPageSizeChange" | "filters" | "actions"
>) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-600">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
        {filters}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-slate-600 whitespace-nowrap">Search:</label>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded border border-slate-300 px-2 py-1 min-w-[180px]"
          />
        </div>
        {actions}
      </div>
    </div>
  );
}

export function DataTablePagination({
  rangeStart,
  rangeEnd,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
}: Pick<
  DataTableControlsProps,
  "rangeStart" | "rangeEnd" | "totalItems" | "currentPage" | "totalPages" | "onPageChange"
>) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
      <p>
        Showing {rangeStart} to {rangeEnd} of {totalItems} entries
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
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
                  onClick={() => onPageChange(p)}
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
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function DataTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">{children}</div>
  );
}
