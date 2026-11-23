"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  DataTablePagination,
  DataTableShell,
  DataTableToolbar,
  useDataTable,
} from "@/components/ui/DataTableControls";
import { hrFetchJson } from "@/lib/hr-fetch";
import { formatRupiah } from "@/lib/payroll-policy";

type DigitalAsset = {
  id: string;
  serviceName: string;
  billingCycle: "BULANAN" | "TAHUNAN";
  cost: number;
  activeFrom: string;
};

type FormState = {
  serviceName: string;
  billingCycle: "BULANAN" | "TAHUNAN";
  cost: string;
  activeFrom: string;
};

const EMPTY_FORM: FormState = {
  serviceName: "",
  billingCycle: "BULANAN",
  cost: "",
  activeFrom: new Date().toISOString().slice(0, 10),
};

const BILLING_LABELS: Record<DigitalAsset["billingCycle"], string> = {
  BULANAN: "Bulanan",
  TAHUNAN: "Tahunan",
};

function matchDigitalAsset(item: DigitalAsset, q: string) {
  return (
    item.serviceName.toLowerCase().includes(q) ||
    BILLING_LABELS[item.billingCycle].toLowerCase().includes(q) ||
    String(item.cost).includes(q) ||
    new Date(item.activeFrom).toLocaleDateString("id-ID").includes(q)
  );
}

export function DigitalAssetManager({ embedded = false }: { embedded?: boolean }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<DigitalAsset[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterBilling, setFilterBilling] = useState("");

  const filterFn = useCallback((row: DigitalAsset, q: string) => matchDigitalAsset(row, q), []);

  const table = useDataTable(items, filterFn, 10);

  const displayed = useMemo(() => {
    if (!filterBilling) return table.filtered;
    return table.filtered.filter((i) => i.billingCycle === filterBilling);
  }, [table.filtered, filterBilling]);

  const totalPages = Math.max(1, Math.ceil(displayed.length / table.pageSize));
  const currentPage = Math.min(table.page, totalPages);
  const pageRows = displayed.slice((currentPage - 1) * table.pageSize, currentPage * table.pageSize);
  const rangeStart = displayed.length === 0 ? 0 : (currentPage - 1) * table.pageSize + 1;
  const rangeEnd = Math.min(currentPage * table.pageSize, displayed.length);

  async function load() {
    setLoading(true);
    const res = await hrFetchJson<{ items: DigitalAsset[] }>("/api/digital-assets");
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
  }, []);

  const totals = useMemo(() => {
    const monthly = items
      .filter((i) => i.billingCycle === "BULANAN")
      .reduce((s, i) => s + i.cost, 0);
    const yearly = items
      .filter((i) => i.billingCycle === "TAHUNAN")
      .reduce((s, i) => s + i.cost, 0);
    return { monthly, yearly, monthlyEquiv: monthly + yearly / 12 };
  }, [items]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/digital-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Aset digital ditambahkan", "success");
    setForm({ ...EMPTY_FORM, activeFrom: new Date().toISOString().slice(0, 10) });
    setShowAdd(false);
    load();
  }

  function startEdit(item: DigitalAsset) {
    setEditingId(item.id);
    setEditForm({
      serviceName: item.serviceName,
      billingCycle: item.billingCycle,
      cost: String(item.cost),
      activeFrom: item.activeFrom.slice(0, 10),
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const res = await hrFetchJson(`/api/digital-assets/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Aset digital diperbarui", "success");
    setEditingId(null);
    load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Hapus aset digital "${name}"?`)) return;
    const res = await hrFetchJson(`/api/digital-assets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Aset digital dihapus", "success");
    load();
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <p className="text-sm text-slate-500">
          Langganan & layanan digital perusahaan (SaaS, domain, lisensi, dll.)
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Total bulanan</p>
          <p className="text-lg font-bold text-slate-900">{formatRupiah(totals.monthly)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Total tahunan (per tagihan)</p>
          <p className="text-lg font-bold text-slate-900">{formatRupiah(totals.yearly)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Estimasi / bulan (tahunan ÷ 12)</p>
          <p className="text-lg font-bold text-emerald-700">{formatRupiah(Math.round(totals.monthlyEquiv))}</p>
        </div>
      </div>

      <DataTableShell>
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Daftar Aset Digital</h2>
          <p className="text-xs text-slate-500 mt-0.5">Langganan SaaS, domain, lisensi, dan layanan online</p>
        </div>

        <DataTableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Cari layanan, biaya..."
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          filters={
            <select
              value={filterBilling}
              onChange={(e) => {
                setFilterBilling(e.target.value);
                table.setPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-slate-700"
            >
              <option value="">Semua periode</option>
              <option value="BULANAN">Bulanan</option>
              <option value="TAHUNAN">Tahunan</option>
            </select>
          }
          actions={
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {showAdd ? "Tutup form" : "+ Tambah layanan"}
            </button>
          }
        />

        {showAdd && (
          <form
            onSubmit={submit}
            className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <input
              placeholder="Nama layanan *"
              value={form.serviceName}
              onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
              className="input-field sm:col-span-2 lg:col-span-1"
              required
            />
            <select
              value={form.billingCycle}
              onChange={(e) => setForm({ ...form, billingCycle: e.target.value as FormState["billingCycle"] })}
              className="input-field"
            >
              <option value="BULANAN">Bulanan</option>
              <option value="TAHUNAN">Tahunan</option>
            </select>
            <input
              type="number"
              min="1"
              placeholder="Biaya (Rp) *"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className="input-field"
              required
            />
            <input
              type="date"
              value={form.activeFrom}
              onChange={(e) => setForm({ ...form, activeFrom: e.target.value })}
              className="input-field"
              title="Mulai aktif tanggal"
              required
            />
            <button type="submit" className="btn-primary sm:col-span-2 lg:col-span-4">
              Simpan
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Nama layanan</th>
                <th className="px-4 py-2.5 font-semibold">Periode</th>
                <th className="px-4 py-2.5 font-semibold">Biaya</th>
                <th className="px-4 py-2.5 font-semibold">Mulai aktif</th>
                <th className="px-4 py-2.5 font-semibold w-28"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                pageRows.map((item, i) =>
                  editingId === item.id ? (
                    <tr key={item.id} className="bg-amber-50/60">
                      <td colSpan={5} className="px-4 py-3">
                        <form onSubmit={saveEdit} className="grid sm:grid-cols-4 gap-2 items-end">
                          <input
                            value={editForm.serviceName}
                            onChange={(e) => setEditForm({ ...editForm, serviceName: e.target.value })}
                            className="input-field"
                            required
                          />
                          <select
                            value={editForm.billingCycle}
                            onChange={(e) =>
                              setEditForm({ ...editForm, billingCycle: e.target.value as FormState["billingCycle"] })
                            }
                            className="input-field"
                          >
                            <option value="BULANAN">Bulanan</option>
                            <option value="TAHUNAN">Tahunan</option>
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={editForm.cost}
                            onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                            className="input-field"
                            required
                          />
                          <input
                            type="date"
                            value={editForm.activeFrom}
                            onChange={(e) => setEditForm({ ...editForm, activeFrom: e.target.value })}
                            className="input-field"
                            required
                          />
                          <div className="sm:col-span-4 flex gap-2">
                            <button type="submit" className="btn-primary text-xs px-3 py-1.5">
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="btn-secondary text-xs px-3 py-1.5"
                            >
                              Batal
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
                      <td className="px-4 py-2.5 border-t border-slate-100 font-medium">{item.serviceName}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.billingCycle === "BULANAN"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          {BILLING_LABELS[item.billingCycle]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-t border-slate-100 font-medium">{formatRupiah(item.cost)}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100 text-slate-600">
                        {new Date(item.activeFrom).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-2.5 border-t border-slate-100 space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="text-xs text-blue-600 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(item.id, item.serviceName)}
                          className="text-xs text-red-600 font-medium"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        <DataTablePagination
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalItems={displayed.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={table.setPage}
        />
      </DataTableShell>
    </div>
  );
}
