"use client";

import { useEffect, useState } from "react";
import { MONTHS_ID } from "@/lib/period";

type SyncLog = {
  id: string;
  type: string;
  status: string;
  message: string | null;
  createdAt: string;
};

export default function GoogleSyncPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function loadLogs() {
    fetch("/api/integrations/google/sync")
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? []);
        setWebhookConfigured(d.webhookConfigured ?? false);
      })
      .catch(() => {});
  }

  useEffect(() => { loadLogs(); }, []);

  async function handleSync() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/integrations/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    const data = await res.json();
    setMessage(data.message ?? (data.ok ? "Berhasil" : "Gagal"));
    loadLogs();
    setLoading(false);
  }

  function exportPdf() {
    window.open(`/api/finance/cashflow?year=${year}&month=${month}&format=pdf`, "_blank");
  }

  return (
    <div className="space-y-6 p-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Google Workspace Sync</h1>
        <p className="text-slate-500 text-sm mt-1">
          Kirim cash flow ke Google Apps Script — set GOOGLE_SYNC_WEBHOOK_URL di .env
        </p>
        <p className={`text-sm mt-2 ${webhookConfigured ? "text-emerald-600" : "text-amber-600"}`}>
          Webhook: {webhookConfigured ? "Terkonfigurasi ✓" : "Belum dikonfigurasi — export PDF tetap bisa"}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl bg-white border p-4">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border px-3 py-2 text-sm">
          {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded border px-3 py-2 text-sm">
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={handleSync} disabled={loading} className="btn-primary">
          {loading ? "..." : "Sync ke Google Sheets"}
        </button>
        <button onClick={exportPdf} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Export PDF → Arsip
        </button>
      </div>

      {message && <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{message}</p>}

      <div className="rounded-xl border overflow-x-auto overscroll-x-contain">
        <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm">Riwayat Sync</div>
        <table className="w-full min-w-[640px] text-sm">
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-slate-500">Belum ada sync</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">{log.type}</td>
                  <td className="px-4 py-3">{log.status}</td>
                  <td className="px-4 py-3 text-slate-500">{log.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-slate-50 border p-4 text-xs text-slate-600 space-y-2">
        <p><strong>Google Apps Script</strong> — contoh endpoint di GAS:</p>
        <pre className="bg-white p-2 rounded border overflow-x-auto">{`function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  // Tulis ke Google Sheets / Drive
  return ContentService.createTextOutput("OK");
}`}</pre>
        <p><strong>POS Webhook</strong> — POST /api/integrations/pos/webhook</p>
        <p>Header: x-pos-api-key = POS_WEBHOOK_API_KEY (dari .env)</p>
      </div>
    </div>
  );
}
