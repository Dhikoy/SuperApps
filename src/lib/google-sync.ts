export type GoogleSyncPayload = {
  type: "CASHFLOW" | "PAYROLL" | "PRESENSI";
  periodLabel: string;
  year: number;
  month: number;
  data: Record<string, unknown>;
  exportedAt: string;
};

export function buildGoogleSyncPayload(input: Omit<GoogleSyncPayload, "exportedAt">): GoogleSyncPayload {
  return {
    ...input,
    exportedAt: new Date().toISOString(),
  };
}

export async function pushToGoogleWebhook(payload: GoogleSyncPayload): Promise<{ ok: boolean; message: string }> {
  const webhookUrl = process.env.GOOGLE_SYNC_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, message: "GOOGLE_SYNC_WEBHOOK_URL belum dikonfigurasi di .env" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, message: `Webhook gagal: HTTP ${res.status}` };
    }
    return { ok: true, message: "Data terkirim ke Google Apps Script" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Gagal kirim webhook" };
  }
}
