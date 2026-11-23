type NotifyPayload = {
  title: string;
  message: string;
  channel?: "email" | "whatsapp" | "general";
  to?: string;
  metadata?: Record<string, string>;
};

/** Kirim notifikasi via webhook (email/WA gateway) jika NOTIFY_WEBHOOK_URL diset */
export async function sendNotification(payload: NotifyPayload) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) {
    console.info("[notify:skipped]", payload.title, payload.message);
    return { sent: false, reason: "NOTIFY_WEBHOOK_URL not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        app: "SuperApps BCI",
        timestamp: new Date().toISOString(),
      }),
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    console.error("[notify:error]", err);
    return { sent: false, reason: String(err) };
  }
}

export async function notifyLeaveApproved(employeeName: string, leaveType: string, to?: string) {
  return sendNotification({
    title: "Cuti Disetujui",
    message: `Pengajuan ${leaveType} untuk ${employeeName} telah disetujui.`,
    channel: "general",
    to,
  });
}

export async function notifyPendingApproval(
  approverName: string,
  type: string,
  count: number,
  to?: string
) {
  return sendNotification({
    title: "Menunggu Persetujuan",
    message: `${approverName}: ada ${count} ${type} menunggu persetujuan Anda.`,
    channel: "general",
    to,
  });
}
