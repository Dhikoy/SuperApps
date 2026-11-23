import type { FundRequestStatus } from "@/generated/prisma/client";

export const FINANCE_FLOW_LABEL =
  "Admin Keuangan → Direksi (Approve) → Eksekutor Bayar → Admin Keuangan (Realisasi)";

export function getFinanceStageLabel(status: FundRequestStatus): string {
  const labels: Record<FundRequestStatus, string> = {
    PENDING: "Menunggu Persetujuan Direksi",
    APPROVED: "Menunggu Pembayaran",
    PAID: "Menunggu Realisasi",
    REALIZED: "Selesai",
    REJECTED: "Ditolak",
  };
  return labels[status];
}

export function getNextFinanceAction(
  status: FundRequestStatus
): "approve" | "pay" | "realize" | "done" | "rejected" {
  if (status === "REJECTED" || status === "REALIZED") return status === "REJECTED" ? "rejected" : "done";
  if (status === "PENDING") return "approve";
  if (status === "APPROVED") return "pay";
  if (status === "PAID") return "realize";
  return "done";
}

export function calcItemSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

export function calcTotalAmount(items: { subtotal: number }[]): number {
  return items.reduce((sum, i) => sum + i.subtotal, 0);
}
