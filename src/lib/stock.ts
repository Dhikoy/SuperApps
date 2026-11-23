import { prisma } from "@/lib/prisma";
import { calcItemSubtotal } from "@/lib/finance-workflow";

export type StockAlert = {
  stockItemId: string;
  name: string;
  company: string;
  currentQty: number;
  minQuantity: number;
  shortage: number;
  unit: string;
};

export function detectStockAlerts(items: { id: string; name: string; company: string; currentQty: number; minQuantity: number; unit: string }[]): StockAlert[] {
  return items
    .filter((item) => item.currentQty < item.minQuantity)
    .map((item) => ({
      stockItemId: item.id,
      name: item.name,
      company: item.company,
      currentQty: item.currentQty,
      minQuantity: item.minQuantity,
      shortage: item.minQuantity - item.currentQty,
      unit: item.unit,
    }));
}

export async function createFundRequestFromStockAlert(
  alert: StockAlert,
  submittedBy: string,
  unitPrice: number
) {
  const qty = alert.shortage;
  const subtotal = calcItemSubtotal(qty, unitPrice);

  return prisma.fundRequest.create({
    data: {
      title: `Restock: ${alert.name}`,
      company: alert.company,
      description: `Auto-suggest dari stock opname. Stok ${alert.currentQty} ${alert.unit}, minimum ${alert.minQuantity} ${alert.unit}.`,
      totalAmount: subtotal,
      submittedBy,
      items: {
        create: [{
          itemName: alert.name,
          quantity: qty,
          unit: alert.unit,
          unitPrice,
          subtotal,
        }],
      },
    },
    include: { items: true },
  });
}
