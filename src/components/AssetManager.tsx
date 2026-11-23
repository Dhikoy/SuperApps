"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { AssetTransferPanel } from "@/components/AssetTransferPanel";
import { printAssetLabels } from "@/lib/print-asset-labels";
import { assetCodePrefix, formatAssetCode, nextAssetSeq } from "@/lib/asset-code";
import {
  DataTablePagination,
  DataTableShell,
  DataTableToolbar,
  useDataTable,
} from "@/components/ui/DataTableControls";

type Asset = {
  id: string;
  laptop: string;
  serialNumber: string;
  condition: string;
  warehouse: string;
  specification: string | null;
  quantity: number;
  category: string | null;
  usageNote: string | null;
  photoPath: string | null;
  userId: string | null;
  user: { name: string; nik: string } | null;
};

type Employee = { nik: string; name: string; company?: string | null };

type AssetForm = {
  laptop: string;
  serialNumber: string;
  condition: string;
  warehouse: string;
  specification: string;
  quantity: string;
  category: string;
  usageNote: string;
  userId: string;
};

const EMPTY_FORM: AssetForm = {
  laptop: "",
  serialNumber: "",
  condition: "Baik",
  warehouse: "Kantor",
  specification: "",
  quantity: "1",
  category: "Asset Kantor",
  usageNote: "",
  userId: "",
};

function locationChoice(warehouse: string, employees: Employee[]) {
  const match = employees.find((employee) => employee.name === warehouse);
  return match ? `emp:${match.nik}` : `loc:${warehouse}`;
}

function LocationSelect({
  warehouse,
  employees,
  offices,
  onChange,
}: {
  warehouse: string;
  employees: Employee[];
  offices: string[];
  onChange: (next: { warehouse: string; userId?: string }) => void;
}) {
  const officeNames = [...new Set(["Kantor", ...offices].filter(Boolean))];
  const employeeNames = new Set(employees.map((employee) => employee.name));
  const extra =
    warehouse && !officeNames.includes(warehouse) && !employeeNames.has(warehouse) ? [warehouse] : [];
  const duplicateNames = new Set(
    employees
      .map((employee) => employee.name)
      .filter((name, index, all) => all.indexOf(name) !== index)
  );

  return (
    <select
      className="input-field"
      required
      value={locationChoice(warehouse, employees)}
      onChange={(e) => {
        const value = e.target.value;
        if (value.startsWith("emp:")) {
          const nik = value.slice(4);
          const employee = employees.find((item) => item.nik === nik);
          onChange({ warehouse: employee?.name ?? warehouse, userId: nik });
          return;
        }
        onChange({ warehouse: value.slice(4) });
      }}
    >
      <optgroup label="Lokasi kantor">
        {[...officeNames, ...extra].map((name) => (
          <option key={name} value={`loc:${name}`}>
            {name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Dibawa karyawan">
        {employees.map((employee) => (
          <option key={employee.nik} value={`emp:${employee.nik}`}>
            {duplicateNames.has(employee.name) ? `${employee.name} (${employee.nik})` : employee.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function PhotoPicker({
  file,
  onChange,
  inputKey,
  currentSrc,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  inputKey: number;
  currentSrc?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? currentSrc ?? null;

  return (
    <label className="flex items-center gap-3 text-xs text-slate-600">
      {shown ? (
        <img src={shown} alt="" className="h-12 w-16 rounded object-cover bg-slate-100" />
      ) : (
        <span className="flex h-12 w-16 items-center justify-center rounded bg-slate-100 text-slate-400">Foto</span>
      )}
      <span className="min-w-0">
        Unggah foto
        <input
          key={inputKey}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-xs"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <span className="text-slate-400">JPG, PNG, atau WebP, maks. 5 MB</span>
      </span>
    </label>
  );
}

const CONDITIONS = ["Baik", "Rusak Ringan", "Rusak Berat"];

function matchPhysicalAsset(asset: Asset, q: string) {
  return (
    asset.laptop.toLowerCase().includes(q) ||
    asset.serialNumber.toLowerCase().includes(q) ||
    asset.condition.toLowerCase().includes(q) ||
    asset.warehouse.toLowerCase().includes(q) ||
    (asset.specification ?? "").toLowerCase().includes(q) ||
    (asset.category ?? "").toLowerCase().includes(q) ||
    (asset.usageNote ?? "").toLowerCase().includes(q) ||
    (asset.user?.name ?? "").toLowerCase().includes(q) ||
    (asset.user?.nik ?? "").toLowerCase().includes(q)
  );
}

function conditionChoices(current: string) {
  return [...new Set([...CONDITIONS, current].filter(Boolean))];
}

export function AssetManager({ canManage }: { canManage: boolean }) {
  const { showToast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offices, setOffices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM);
  const [codeTouched, setCodeTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AssetForm>(EMPTY_FORM);
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [addPhotoKey, setAddPhotoKey] = useState(0);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoKey, setEditPhotoKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [filterCondition, setFilterCondition] = useState("");
  const [filterAssignment, setFilterAssignment] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");

  const filterFn = useCallback((row: Asset, q: string) => matchPhysicalAsset(row, q), []);

  const table = useDataTable(assets, filterFn, 10);

  const codePrefix = useMemo(() => {
    const holder = employees.find((employee) => employee.name === form.warehouse);
    return assetCodePrefix({
      location: form.warehouse,
      offices: ["Kantor", ...offices],
      isEmployee: !!holder,
      employeeCompany: holder?.company,
    });
  }, [form.warehouse, employees, offices]);

  const autoCode = useMemo(
    () => formatAssetCode(codePrefix, nextAssetSeq(assets.map((a) => a.serialNumber), codePrefix)),
    [codePrefix, assets]
  );
  const shownCode = codeTouched ? form.serialNumber : autoCode;

  const warehouses = useMemo(
    () => [...new Set(assets.map((a) => a.warehouse).filter(Boolean))].sort(),
    [assets]
  );

  const displayed = useMemo(() => {
    return table.filtered.filter((a) => {
      if (filterCondition && a.condition !== filterCondition) return false;
      if (filterAssignment === "assigned" && !a.userId) return false;
      if (filterAssignment === "unassigned" && a.userId) return false;
      if (filterWarehouse && a.warehouse !== filterWarehouse) return false;
      return true;
    });
  }, [table.filtered, filterCondition, filterAssignment, filterWarehouse]);

  const totalPages = Math.max(1, Math.ceil(displayed.length / table.pageSize));
  const currentPage = Math.min(table.page, totalPages);
  const pageRows = displayed.slice((currentPage - 1) * table.pageSize, currentPage * table.pageSize);
  const rangeStart = displayed.length === 0 ? 0 : (currentPage - 1) * table.pageSize + 1;
  const rangeEnd = Math.min(currentPage * table.pageSize, displayed.length);

  function load() {
    setLoading(true);
    fetch("/api/assets")
      .then((r) => r.json())
      .then(setAssets)
      .catch(() => showToast("Gagal memuat aset", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    if (canManage) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => setEmployees(Array.isArray(data) ? data : []))
        .catch(() => {});
      fetch("/api/offices")
        .then((r) => r.json())
        .then((data) =>
          setOffices(
            Array.isArray(data) ? data.map((office: { name?: string }) => office.name ?? "").filter(Boolean) : []
          )
        )
        .catch(() => {});
    }
  }, [canManage]);

  async function uploadPhoto(assetId: string, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Foto maksimal 5 MB");
    }
    const body = new FormData();
    body.append("photo", file);
    const res = await fetch(`/api/assets/${assetId}/photo`, { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Gagal mengunggah foto");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        serialNumber: shownCode,
        autoCode: !codeTouched,
        codePrefix,
        quantity: Number(form.quantity) || 1,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error ?? "Gagal menambah aset", "error");
      return;
    }
    if (addPhoto) {
      try {
        await uploadPhoto(data.id, addPhoto);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Aset tersimpan, foto gagal diunggah", "error");
        setAddPhoto(null);
        setAddPhotoKey((key) => key + 1);
        load();
        return;
      }
    }
    showToast(`Aset ${data.serialNumber} berhasil ditambahkan`, "success");
    setForm(EMPTY_FORM);
    setCodeTouched(false);
    setAddPhoto(null);
    setAddPhotoKey((key) => key + 1);
    setShowAdd(false);
    load();
  }

  function startEdit(asset: Asset) {
    setEditingId(asset.id);
    setEditForm({
      laptop: asset.laptop,
      serialNumber: asset.serialNumber,
      condition: asset.condition,
      warehouse: asset.warehouse,
      specification: asset.specification ?? "",
      quantity: String(asset.quantity ?? 1),
      category: asset.category ?? "",
      usageNote: asset.usageNote ?? "",
      userId: asset.userId ?? "",
    });
    setEditPhoto(null);
    setEditPhotoKey((key) => key + 1);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const res = await fetch(`/api/assets/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, quantity: Number(editForm.quantity) || 1 }),
    });
    if (!res.ok) {
      const data = await res.json();
      showToast(data.error ?? "Gagal menyimpan", "error");
      return;
    }
    if (editPhoto) {
      try {
        await uploadPhoto(editingId, editPhoto);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Data tersimpan, foto gagal diunggah", "error");
        load();
        return;
      }
    }
    showToast("Aset diperbarui", "success");
    setEditingId(null);
    setEditPhoto(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus aset ini?")) return;
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Gagal menghapus aset", "error");
      return;
    }
    showToast("Aset dihapus", "success");
    load();
  }

  function toLabel(asset: Asset) {
    return {
      name: asset.laptop,
      serialNumber: asset.serialNumber,
      specification: asset.specification,
      quantity: asset.quantity,
      condition: asset.condition,
      warehouse: asset.warehouse,
    };
  }

  function printOne(asset: Asset) {
    const ok = printAssetLabels([toLabel(asset)]);
    if (!ok) showToast("Izinkan pop-up untuk mencetak label", "error");
  }

  function printFiltered() {
    if (displayed.length === 0) {
      showToast("Tidak ada aset untuk dicetak", "error");
      return;
    }
    const ok = printAssetLabels(displayed.map(toLabel));
    if (!ok) showToast("Izinkan pop-up untuk mencetak label", "error");
  }

  async function exportXls() {
    if (displayed.length === 0) {
      showToast("Tidak ada aset untuk diekspor", "error");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/assets/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: displayed.map((asset) => asset.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Gagal mengekspor aset", "error");
        return;
      }
      const blob = await res.blob();
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aset-fisik-${stamp}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Gagal mengekspor aset", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <DataTableShell>
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Daftar Aset Fisik</h2>
          <p className="text-xs text-slate-500 mt-0.5">Inventaris kantor: perangkat, perabot, dan barang fisik</p>
        </div>

        <DataTableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Cari nama, kode, spesifikasi, PIC..."
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          filters={
            <>
              <select
                value={filterCondition}
                onChange={(e) => {
                  setFilterCondition(e.target.value);
                  table.setPage(1);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-slate-700"
              >
                <option value="">Semua kondisi</option>
                {[...new Set([...CONDITIONS, ...assets.map((a) => a.condition)].filter(Boolean))].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterAssignment}
                onChange={(e) => {
                  setFilterAssignment(e.target.value);
                  table.setPage(1);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-slate-700"
              >
                <option value="">Semua PIC</option>
                <option value="assigned">Sudah ditugaskan</option>
                <option value="unassigned">Belum ditugaskan</option>
              </select>
              <select
                value={filterWarehouse}
                onChange={(e) => {
                  setFilterWarehouse(e.target.value);
                  table.setPage(1);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-slate-700"
              >
                <option value="">Semua lokasi</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportXls} disabled={exporting} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60">
                {exporting ? "Mengekspor..." : "Export XLS"}
              </button>
              <button type="button" onClick={printFiltered} className="btn-secondary text-xs px-3 py-1.5">
                Cetak label
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowTransfer((open) => !open)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  {showTransfer ? "Tutup transfer" : "Transfer aset"}
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowAdd((v) => !v)}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {showAdd ? "Tutup form" : "+ Tambah aset"}
                </button>
              )}
            </div>
          }
        />

        {canManage && showTransfer && (
          <AssetTransferPanel
            assets={assets}
            employees={employees}
            showToast={showToast}
            onClose={() => setShowTransfer(false)}
            onCompleted={load}
          />
        )}

        {canManage && showAdd && (
          <form
            onSubmit={handleSubmit}
            className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <input
              placeholder="Nama barang *"
              value={form.laptop}
              onChange={(e) => setForm({ ...form, laptop: e.target.value })}
              className="input-field"
              required
            />
            <div className="relative">
              <input
                placeholder="Kode / serial *"
                title="Otomatis mengikuti lokasi kantor; boleh diubah manual"
                value={shownCode}
                onChange={(e) => {
                  setCodeTouched(true);
                  setForm({ ...form, serialNumber: e.target.value });
                }}
                className="input-field w-full pr-20 font-mono"
                required
              />
              {codeTouched ? (
                <button
                  type="button"
                  onClick={() => setCodeTouched(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-orange-700"
                >
                  Otomatis
                </button>
              ) : (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">otomatis</span>
              )}
            </div>
            <input
              placeholder="Spesifikasi"
              value={form.specification}
              onChange={(e) => setForm({ ...form, specification: e.target.value })}
              className="input-field"
            />
            <input
              type="number"
              min={1}
              placeholder="Jumlah *"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="input-field"
              required
            />
            <input
              placeholder="Jenis inventaris"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field"
              list="asset-categories"
            />
            <datalist id="asset-categories">
              <option value="Asset Kantor" />
              <option value="Asset Ruko" />
            </datalist>
            <input
              placeholder="Kondisi *"
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className="input-field"
              list="asset-conditions"
              required
            />
            <datalist id="asset-conditions">
              {CONDITIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <LocationSelect
              warehouse={form.warehouse}
              employees={employees}
              offices={offices}
              onChange={(next) => setForm({ ...form, ...next })}
            />
            <input
              placeholder="Kebutuhan / pemakaian"
              value={form.usageNote}
              onChange={(e) => setForm({ ...form, usageNote: e.target.value })}
              className="input-field"
            />
            <select
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="input-field"
            >
              <option value="">Belum ditugaskan</option>
              {employees.map((e) => (
                <option key={e.nik} value={e.nik}>
                  {e.name}
                </option>
              ))}
            </select>
            <PhotoPicker
              file={addPhoto}
              inputKey={addPhotoKey}
              onChange={(file) => {
                if (file && file.size > 5 * 1024 * 1024) {
                  showToast("Foto maksimal 5 MB", "error");
                  setAddPhotoKey((key) => key + 1);
                  return;
                }
                setAddPhoto(file);
              }}
            />
            <button type="submit" className="btn-primary">
              Simpan
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Foto</th>
                <th className="px-4 py-2.5 font-semibold">Nama barang</th>
                <th className="px-4 py-2.5 font-semibold">Kode</th>
                <th className="px-4 py-2.5 font-semibold">Spesifikasi</th>
                <th className="px-4 py-2.5 font-semibold">Jml</th>
                <th className="px-4 py-2.5 font-semibold">Kondisi</th>
                <th className="px-4 py-2.5 font-semibold">Lokasi</th>
                <th className="px-4 py-2.5 font-semibold">Pemakaian</th>
                <th className="px-4 py-2.5 font-semibold">Label</th>
                {canManage && <th className="px-4 py-2.5 font-semibold w-28"></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 10 : 9} className="px-4 py-8 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 10 : 9} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                pageRows.map((asset, i) =>
                  editingId === asset.id ? (
                    <tr key={asset.id} className="bg-amber-50/60">
                      <td colSpan={canManage ? 10 : 9} className="px-4 py-3">
                        <form onSubmit={handleUpdate} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <input
                            value={editForm.laptop}
                            onChange={(e) => setEditForm({ ...editForm, laptop: e.target.value })}
                            className="input-field"
                            placeholder="Nama barang"
                            required
                          />
                          <input
                            value={editForm.serialNumber}
                            onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                            className="input-field"
                            placeholder="Kode"
                            required
                          />
                          <input
                            value={editForm.specification}
                            onChange={(e) => setEditForm({ ...editForm, specification: e.target.value })}
                            className="input-field"
                            placeholder="Spesifikasi"
                          />
                          <input
                            type="number"
                            min={1}
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                            className="input-field"
                            placeholder="Jumlah"
                            required
                          />
                          <input
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="input-field"
                            placeholder="Jenis"
                            list="asset-categories"
                          />
                          <input
                            value={editForm.condition}
                            onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                            className="input-field"
                            placeholder="Kondisi"
                            list="asset-conditions-edit"
                            required
                          />
                          <datalist id="asset-conditions-edit">
                            {conditionChoices(editForm.condition).map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                          <LocationSelect
                            warehouse={editForm.warehouse}
                            employees={employees}
                            offices={offices}
                            onChange={(next) => setEditForm({ ...editForm, ...next })}
                          />
                          <input
                            value={editForm.usageNote}
                            onChange={(e) => setEditForm({ ...editForm, usageNote: e.target.value })}
                            className="input-field"
                            placeholder="Pemakaian"
                          />
                          <select
                            value={editForm.userId}
                            onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}
                            className="input-field"
                          >
                            <option value="">Belum ditugaskan</option>
                            {employees.map((emp) => (
                              <option key={emp.nik} value={emp.nik}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2 sm:col-span-2">
                            <PhotoPicker
                              file={editPhoto}
                              inputKey={editPhotoKey}
                              currentSrc={
                                pageRows.find((row) => row.id === editingId)?.photoPath
                                  ? `/api/asset-photos/${pageRows.find((row) => row.id === editingId)?.photoPath}`
                                  : null
                              }
                              onChange={(file) => {
                                if (file && file.size > 5 * 1024 * 1024) {
                                  showToast("Foto maksimal 5 MB", "error");
                                  setEditPhotoKey((key) => key + 1);
                                  return;
                                }
                                setEditPhoto(file);
                              }}
                            />
                            <button type="submit" className="btn-primary text-xs px-2 py-1.5 flex-1">
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditPhoto(null);
                              }}
                              className="btn-secondary text-xs px-2 py-1.5"
                            >
                              Batal
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={asset.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
                      <td className="px-4 py-2.5 border-t border-slate-100">
                        {asset.photoPath ? (
                          <a href={`/api/asset-photos/${asset.photoPath}`} target="_blank" rel="noreferrer">
                            <img
                              src={`/api/asset-photos/${asset.photoPath}`}
                              alt={asset.laptop}
                              className="h-12 w-16 rounded object-cover bg-slate-100"
                            />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 border-t border-slate-100 font-medium">{asset.laptop}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100 font-mono text-xs">{asset.serialNumber}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100">{asset.specification || "—"}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100">{asset.quantity ?? 1}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100">{asset.condition}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100">{asset.warehouse}</td>
                      <td className="px-4 py-2.5 border-t border-slate-100">
                        <div>{asset.usageNote || "—"}</div>
                        {asset.user && (
                          <div className="text-xs text-orange-700 font-medium">{asset.user.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => printOne(asset)}
                          className="text-xs text-slate-700 font-medium"
                        >
                          Cetak
                        </button>
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5 border-t border-slate-100 space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => startEdit(asset)}
                            className="text-xs text-blue-600 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(asset.id)}
                            className="text-xs text-red-600 font-medium"
                          >
                            Hapus
                          </button>
                        </td>
                      )}
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
