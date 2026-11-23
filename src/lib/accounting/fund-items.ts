import { calcItemSubtotal } from "@/lib/finance-workflow";
import { assertAccount, type Db } from "./journal";

type RawItem = { itemName?: unknown; quantity?: unknown; unit?: unknown; unitPrice?: unknown; accountCode?: unknown };

/** Item pengajuan + akun beban/aset (opsional; kosong = akun default saat realisasi). */
export async function parseFundItems(db: Db, items: RawItem[]) {
  const parsed = [];
  for (const item of items) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const accountCode = await assertAccount(db, typeof item.accountCode === "string" ? item.accountCode : null, {
      label: `Akun item "${String(item.itemName ?? "").trim()}"`,
      groups: ["EXPENSE", "ASSET", "LIABILITY"],
    });
    parsed.push({
      itemName: String(item.itemName ?? "").trim(),
      quantity,
      unit: (typeof item.unit === "string" && item.unit.trim()) || "unit",
      unitPrice,
      subtotal: calcItemSubtotal(quantity, unitPrice),
      accountCode,
    });
  }
  return parsed;
}
