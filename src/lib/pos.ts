import type { PosTransactionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertAccount,
  deleteSourceJournal,
  syncIncomeJournal,
  syncPosJournal,
  type Db,
} from "@/lib/accounting/journal";

export type PosImportPayload = {
  company?: string;
  outlet?: string;
  type: PosTransactionType;
  amount: number;
  description?: string;
  transactionDate: string;
  externalRef?: string;
  accountCode?: string;
  cashAccount?: string;
};

export async function parsePosAccounts(
  db: Db,
  type: PosTransactionType,
  body: { accountCode?: unknown; cashAccount?: unknown }
) {
  const accountCode = await assertAccount(db, typeof body.accountCode === "string" ? body.accountCode : null, {
    label: type === "SALE" ? "Akun pendapatan" : "Akun beban",
    groups: type === "SALE" ? ["REVENUE"] : ["EXPENSE", "ASSET"],
  });
  const cashAccount = await assertAccount(db, typeof body.cashAccount === "string" ? body.cashAccount : null, {
    label: "Kas/Bank",
    cash: true,
  });
  return { accountCode, cashAccount };
}

/** Cari pendapatan milik transaksi POS; data lama (sebelum ada posTransactionId) dicocokkan lalu ditautkan. */
async function findLinkedIncome(db: Db, pos: { id: string; company: string; amount: number; transactionDate: Date; externalRef: string | null }) {
  const linked = await db.incomeEntry.findUnique({ where: { posTransactionId: pos.id } });
  if (linked) return linked;
  const legacy = await db.incomeEntry.findFirst({
    where: {
      posTransactionId: null,
      source: "POS",
      company: pos.company,
      ...(pos.externalRef
        ? { remarks: `POS ref: ${pos.externalRef}` }
        : { amount: pos.amount, entryDate: pos.transactionDate }),
    },
  });
  if (!legacy) return null;
  return db.incomeEntry.update({ where: { id: legacy.id }, data: { posTransactionId: pos.id } });
}

/** Selaraskan pendapatan (untuk SALE) dan jurnal (untuk EXPENSE) dengan transaksi POS. */
export async function syncPosDerived(db: Db, posId: string, createdByNik: string, opts: { isNew?: boolean } = {}) {
  const pos = await db.posTransaction.findUnique({ where: { id: posId } });
  if (!pos) return;
  const income = opts.isNew ? null : await findLinkedIncome(db, pos);

  if (pos.type === "SALE") {
    const data = {
      title: pos.description ?? `Penjualan POS ${pos.outlet ?? pos.company}`,
      company: pos.company,
      amount: pos.amount,
      entryDate: pos.transactionDate,
      accountCode: pos.accountCode,
      cashAccount: pos.cashAccount,
    };
    const row = income
      ? await db.incomeEntry.update({ where: { id: income.id }, data })
      : await db.incomeEntry.create({
          data: {
            ...data,
            source: "POS",
            remarks: pos.externalRef ? `POS ref: ${pos.externalRef}` : `Sync POS ${pos.company}`,
            createdBy: createdByNik,
            posTransactionId: pos.id,
          },
        });
    await syncIncomeJournal(db, row.id);
  } else if (income) {
    await deleteSourceJournal(db, "INCOME", income.id);
    await db.incomeEntry.delete({ where: { id: income.id } });
  }

  await syncPosJournal(db, pos.id);
}

export async function deletePosTransaction(db: Db, posId: string) {
  const pos = await db.posTransaction.findUnique({ where: { id: posId } });
  if (!pos) return;
  const income = await findLinkedIncome(db, pos);
  if (income) {
    await deleteSourceJournal(db, "INCOME", income.id);
    await db.incomeEntry.delete({ where: { id: income.id } });
  }
  await deleteSourceJournal(db, "POS_EXPENSE", pos.id);
  await db.posTransaction.delete({ where: { id: pos.id } });
}

export async function importPosTransaction(payload: PosImportPayload, createdByNik: string) {
  const company = (payload.company ?? "LBB").toUpperCase();
  const transactionDate = new Date(payload.transactionDate);
  transactionDate.setHours(0, 0, 0, 0);

  if (payload.externalRef) {
    const existing = await prisma.posTransaction.findUnique({
      where: { externalRef: payload.externalRef },
    });
    if (existing) return { transaction: existing, duplicate: true };
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const accounts = await parsePosAccounts(tx, payload.type, payload);
    const record = await tx.posTransaction.create({
      data: {
        company,
        outlet: payload.outlet?.trim().toUpperCase() || null,
        type: payload.type,
        amount: payload.amount,
        description: payload.description ?? null,
        transactionDate,
        externalRef: payload.externalRef ?? null,
        ...accounts,
      },
    });
    await syncPosDerived(tx, record.id, createdByNik, { isNew: true });
    return record;
  });

  return { transaction, duplicate: false };
}

export type PosUpsertResult = "created" | "updated" | "unchanged";

/** Simpan rekap berdasarkan externalRef: buat baru, perbarui jika nominal/keterangan berubah. */
export async function upsertPosByRef(
  payload: PosImportPayload & { externalRef: string },
  createdByNik: string
): Promise<PosUpsertResult> {
  const company = (payload.company ?? "LBB").toUpperCase();
  const transactionDate = new Date(payload.transactionDate);
  transactionDate.setHours(0, 0, 0, 0);
  const existing = await prisma.posTransaction.findUnique({ where: { externalRef: payload.externalRef } });

  if (!existing) {
    await importPosTransaction({ ...payload, company }, createdByNik);
    return "created";
  }

  const description = payload.description ?? null;
  if (
    existing.amount === payload.amount &&
    existing.description === description &&
    existing.transactionDate.getTime() === transactionDate.getTime()
  ) {
    return "unchanged";
  }

  await prisma.$transaction(async (tx) => {
    await tx.posTransaction.update({
      where: { id: existing.id },
      data: { amount: payload.amount, description, transactionDate },
    });
    await syncPosDerived(tx, existing.id, createdByNik);
  });
  return "updated";
}

export function calcPosProfit(sales: number, expenses: number): number {
  return sales - expenses;
}
