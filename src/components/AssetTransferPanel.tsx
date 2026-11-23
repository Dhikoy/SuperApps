"use client";

import { useEffect, useState } from "react";

type TransferAsset = {
  id: string;
  laptop: string;
  serialNumber: string;
  condition: string;
  warehouse: string;
  user: { name: string } | null;
};

type Employee = { nik: string; name: string };

type PendingTransfer = {
  id: string;
  assetId: string;
  assetName: string;
  serialNumber: string;
  condition: string;
  fromLocation: string;
  toLocation: string;
  toUserId: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AssetTransferPanel({
  assets,
  employees,
  onClose,
  onCompleted,
  showToast,
}: {
  assets: TransferAsset[];
  employees: Employee[];
  onClose: () => void;
  onCompleted: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [condition, setCondition] = useState("");
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = assets.find((asset) => asset.id === assetId) ?? null;

  useEffect(() => {
    fetch("/api/assets/transfers")
      .then((res) => res.json())
      .then((data) => setPending(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function chooseAsset(id: string) {
    setAssetId(id);
    const asset = assets.find((item) => item.id === id);
    setCondition(asset?.condition ?? "");
  }

  async function downloadForm(id: string, filename: string) {
    const res = await fetch(`/api/assets/transfers/${id}/form`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Gagal mengunduh form");
    }
    downloadBlob(await res.blob(), filename);
  }

  async function createAndDownload(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/assets/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, toUserId, condition }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Gagal membuat form", "error");
        return;
      }
      setPending((rows) => [data, ...rows.filter((row) => row.id !== data.id && row.assetId !== data.assetId)]);
      await downloadForm(data.id, `serah-terima-${selected.serialNumber}.pdf`);
      showToast("Form terunduh. Tanda tangani basah, lalu unggah di bawah.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal mengunduh form", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSigned(id: string, file: File) {
    setUploadFor(id);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/assets/transfers/${id}/signed`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Gagal mengunggah form", "error");
        return;
      }
      setPending((rows) => rows.filter((row) => row.id !== id));
      showToast("Barang sudah pindah ke penerima", "success");
      onCompleted();
    } finally {
      setUploadFor(null);
    }
  }

  const fromText = selected
    ? selected.user && selected.user.name !== selected.warehouse
      ? `${selected.warehouse} (${selected.user.name})`
      : selected.warehouse
    : "";

  return (
    <div className="border-b border-slate-200 bg-amber-50/50 px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Transfer aset</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Unduh form serah terima, tanda tangani basah, lalu unggah. Barang pindah ke penerima setelah form terunggah.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-slate-500">
          Tutup
        </button>
      </div>

      <form onSubmit={createAndDownload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <select className="input-field" required value={assetId} onChange={(e) => chooseAsset(e.target.value)}>
          <option value="">Pilih barang</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.laptop} · {asset.serialNumber}
            </option>
          ))}
        </select>
        <input
          className="input-field"
          required
          placeholder="Kondisi barang"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        />
        <input className="input-field" readOnly value={fromText} placeholder="Dari" />
        <select className="input-field" required value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
          <option value="">Tujuan: pilih karyawan</option>
          {employees.map((employee) => (
            <option key={employee.nik} value={employee.nik}>
              {employee.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} className="btn-primary text-xs px-3 py-2 disabled:opacity-60">
          {busy ? "Menyiapkan..." : "Unduh form"}
        </button>
      </form>

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Menunggu tanda tangan basah</p>
          {pending.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs">
              <span className="font-medium text-slate-800">
                {row.assetName} · {row.serialNumber}
              </span>
              <span className="text-slate-500">
                {row.fromLocation} → {row.toLocation}
              </span>
              <button
                type="button"
                className="text-slate-700 font-medium"
                onClick={() =>
                  downloadForm(row.id, `serah-terima-${row.serialNumber}.pdf`).catch((err) =>
                    showToast(err instanceof Error ? err.message : "Gagal mengunduh form", "error")
                  )
                }
              >
                Unduh lagi
              </button>
              <label className="text-orange-800 font-medium cursor-pointer">
                {uploadFor === row.id ? "Mengunggah..." : "Upload form bertanda tangan"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadFor === row.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadSigned(row.id, file);
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
