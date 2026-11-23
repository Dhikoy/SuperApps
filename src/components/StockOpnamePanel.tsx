"use client";

import { useEffect, useState } from "react";
import { CompanySelect } from "@/components/CompanySelect";

type StockItem = {
  id: string;
  name: string;
  company: string;
  unit: string;
  minQuantity: number;
  currentQty: number;
};

type StockAlert = {
  stockItemId: string;
  name: string;
  company: string;
  currentQty: number;
  minQuantity: number;
  shortage: number;
  unit: string;
};

type StockOpnamePanelProps = {
  title?: string;
  subtitle?: string;
  allowFundSuggest?: boolean;
};

export function StockOpnamePanel({
  title = "Stock Opname",
  subtitle = "Input stok fisik barang operasional",
  allowFundSuggest = true,
}: StockOpnamePanelProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [newItem, setNewItem] = useState({ name: "", company: "BCI", unit: "galon", minQuantity: "3", currentQty: "0" });
  const [opname, setOpname] = useState<Record<string, string>>({});
  const [unitPrices, setUnitPrices] = useState<Record<string, string>>({});

  function load() {
    fetch("/api/finance/stock")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setAlerts(d.alerts ?? []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/finance/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newItem.name,
        company: newItem.company,
        unit: newItem.unit,
        minQuantity: Number(newItem.minQuantity),
        currentQty: Number(newItem.currentQty),
      }),
    });
    setNewItem({ name: "", company: "BCI", unit: "galon", minQuantity: "3", currentQty: "0" });
    load();
  }

  async function submitOpname(itemId: string) {
    await fetch("/api/finance/stock/opname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockItemId: itemId, countedQty: Number(opname[itemId]) }),
    });
    load();
  }

  async function suggestRequest(stockAlert: StockAlert) {
    const price = Number(unitPrices[stockAlert.stockItemId]);
    if (!price) {
      window.alert("Isi harga satuan dulu");
      return;
    }
    await fetch("/api/finance/stock/opname", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockItemId: stockAlert.stockItemId, unitPrice: price }),
    });
    load();
    window.alert("Draft pengajuan dana dibuat — cek menu Pengajuan Dana");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="font-semibold text-amber-800">⚠ Stok di bawah minimum ({alerts.length})</p>
          {alerts.map((a) => (
            <div key={a.stockItemId} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {a.company} — {a.name}: {a.currentQty}/{a.minQuantity} {a.unit} (kurang {a.shortage})
              </span>
              {allowFundSuggest && (
                <>
                  <input
                    type="number"
                    placeholder="Harga/satuan"
                    className="rounded border px-2 py-1 w-28 text-sm"
                    value={unitPrices[a.stockItemId] ?? ""}
                    onChange={(e) => setUnitPrices({ ...unitPrices, [a.stockItemId]: e.target.value })}
                  />
                  <button onClick={() => suggestRequest(a)} className="text-xs font-medium text-amber-800 underline">
                    Buat pengajuan dana
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addItem} className="rounded-xl bg-white border p-5 grid grid-cols-2 gap-3">
        <input
          placeholder="Nama barang"
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          className="input-field col-span-2"
          required
        />
        <CompanySelect
          value={newItem.company}
          onChange={(company) => setNewItem({ ...newItem, company })}
          className="input-field"
        />
        <input placeholder="Satuan" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="input-field" />
        <input type="number" placeholder="Min qty" value={newItem.minQuantity} onChange={(e) => setNewItem({ ...newItem, minQuantity: e.target.value })} className="input-field" />
        <input type="number" placeholder="Stok awal" value={newItem.currentQty} onChange={(e) => setNewItem({ ...newItem, currentQty: e.target.value })} className="input-field" />
        <button type="submit" className="btn-primary col-span-2">
          Tambah Item Stok
        </button>
      </form>

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Barang</th>
              <th className="px-4 py-3">PT</th>
              <th className="px-4 py-3">Stok / Min</th>
              <th className="px-4 py-3">Opname</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">{item.company}</td>
                <td className="px-4 py-3">
                  {item.currentQty} / {item.minQuantity} {item.unit}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="rounded border px-2 py-1 w-20 text-sm"
                      placeholder="Qty"
                      value={opname[item.id] ?? ""}
                      onChange={(e) => setOpname({ ...opname, [item.id]: e.target.value })}
                    />
                    <button onClick={() => submitOpname(item.id)} className="text-xs text-blue-600 font-medium">
                      Simpan
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
