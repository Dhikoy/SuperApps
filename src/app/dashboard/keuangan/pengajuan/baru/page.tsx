"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { INPUT_CLASS } from "@/components/ui";
import { CompanySelect } from "@/components/CompanySelect";
import { FINANCE_FLOW_LABEL } from "@/lib/finance-workflow";
import { formatRupiah } from "@/lib/payroll-policy";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AccountSelect } from "@/components/accounting/AccountSelect";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";

type ItemRow = { itemName: string; quantity: string; unit: string; unitPrice: string; accountCode: string };

const emptyItem = (): ItemRow => ({ itemName: "", quantity: "1", unit: "unit", unitPrice: "", accountCode: "" });

export default function BuatPengajuanPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("BCI");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    void (async () => {
      const res = await fetch("/api/finance/requests");
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      const found = list.find((r: { id: string }) => r.id === editId);
      if (!found || found.status !== "PENDING") {
        setError("Pengajuan tidak bisa diedit (hanya status PENDING)");
        return;
      }
      setEditingId(found.id);
      setTitle(found.title ?? "");
      setCompany(found.company ?? "BCI");
      setDescription(found.description ?? "");
      setItems(
        (found.items ?? []).map(
          (item: { itemName: string; quantity: number; unit: string | null; unitPrice: number; accountCode: string | null }) => ({
            itemName: item.itemName,
            quantity: String(item.quantity),
            unit: item.unit || "unit",
            unitPrice: String(item.unitPrice),
            accountCode: item.accountCode ?? "",
          })
        )
      );
    })();
  }, []);

  function updateItem(idx: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  const total = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unitPrice) || 0;
    return sum + Math.round(q * p);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      title,
      company,
      description,
      items: items.map((item) => ({
        itemName: item.itemName,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        accountCode: item.accountCode || null,
      })),
    };

    const res = await fetch(
      editingId ? `/api/finance/requests/${editingId}` : "/api/finance/requests",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { action: "update", ...payload } : payload),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Gagal menyimpan pengajuan");
      setLoading(false);
      return;
    }

    router.push("/dashboard/keuangan/pengajuan");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {editingId ? "Edit Pengajuan Dana" : "Form Pengajuan Dana"}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">{FINANCE_FLOW_LABEL}</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Judul Pengajuan</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} required placeholder="Contoh: Kebutuhan operasional minggu ini" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Perusahaan (PT)</label>
          <CompanySelect value={company} onChange={setCompany} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Opsional"
            minHeight={90}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Rincian Item</label>
            <button type="button" onClick={addItem} className="text-sm text-blue-600 font-medium">+ Tambah item</button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <input value={item.itemName} onChange={(e) => updateItem(idx, "itemName", e.target.value)} className={INPUT_CLASS} placeholder="Nama barang" required />
              <input type="number" min="0.1" step="0.1" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className={INPUT_CLASS} placeholder="Qty" required />
              <input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className={INPUT_CLASS} placeholder="Satuan" />
              <input type="number" min="1" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} className={INPUT_CLASS} placeholder="Harga" required />
              <div className="col-span-2 sm:col-span-4">
                <AccountSelect
                  value={item.accountCode}
                  onChange={(code) => updateItem(idx, "accountCode", code)}
                  groups={["EXPENSE", "ASSET", "LIABILITY"]}
                  emptyLabel={`Akun beban: default ${DEFAULT_ACCOUNTS.fundExpense} Beban Administrasi Lainnya`}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm font-semibold text-slate-800">Total: {formatRupiah(total)}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Ajukan ke Direksi"}
        </button>
      </form>
    </div>
  );
}
