"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

export function AttendanceSyncSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function handleSync() {
    setLoading(true);
    setResult("");
    const res = await fetch("/api/attendance/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      showToast(data.error ?? "Gagal sync presensi", "error");
      return;
    }
    const msg = `Cuti→IZIN: ${data.leave?.synced ?? 0} hari, ALPHA baru: ${data.alpha?.created ?? 0}`;
    setResult(msg);
    showToast("Sync presensi selesai", "success");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Sinkronkan cuti disetujui ke status IZIN dan tandai ALPHA untuk hari kerja tanpa absen.
      </p>
      <button type="button" onClick={handleSync} disabled={loading} className="btn-primary">
        {loading ? "Memproses..." : "Sync Presensi Sekarang"}
      </button>
      {result && <p className="text-sm text-emerald-700">{result}</p>}
    </div>
  );
}
