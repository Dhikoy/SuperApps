/**
 * Seed COA + jurnal otomatis untuk transaksi lama. Idempoten.
 *   npm run db:accounting-backfill            → hanya yang belum punya jurnal
 *   npm run db:accounting-backfill -- --rebuild → susun ulang semua jurnal otomatis
 */
import "dotenv/config";
import type { JournalSource } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { COA_SEED } from "../src/lib/accounting/coa-data";
import {
  syncFundRequestJournals,
  syncIncomeJournal,
  syncInvoiceJournal,
  syncPayrollJournal,
  syncPosJournal,
} from "../src/lib/accounting/journal";

const rebuild = process.argv.includes("--rebuild");

async function seedCoa() {
  const existing = new Set((await prisma.account.findMany({ select: { code: true } })).map((a) => a.code));
  const missing = COA_SEED.filter((a) => !existing.has(a.code));
  if (missing.length > 0) await prisma.account.createMany({ data: missing });
  console.log(`COA: ${missing.length} akun baru, total ${existing.size + missing.length}`);
}

async function linkLegacyPosIncome() {
  const sales = await prisma.posTransaction.findMany({ where: { type: "SALE" } });
  let linked = 0;
  for (const pos of sales) {
    const already = await prisma.incomeEntry.findUnique({ where: { posTransactionId: pos.id } });
    if (already) continue;
    const match = await prisma.incomeEntry.findFirst({
      where: {
        posTransactionId: null,
        source: "POS",
        company: pos.company,
        ...(pos.externalRef
          ? { remarks: `POS ref: ${pos.externalRef}` }
          : { amount: pos.amount, entryDate: pos.transactionDate }),
      },
    });
    if (match) {
      await prisma.incomeEntry.update({ where: { id: match.id }, data: { posTransactionId: pos.id } });
      linked++;
    }
  }
  console.log(`POS: ${linked} pendapatan lama ditautkan ke transaksi POS`);
}

async function hasJournal(source: JournalSource, sourceId: string) {
  return (await prisma.journalEntry.count({ where: { source, sourceId } })) > 0;
}

async function run(label: string, ids: string[], needs: (id: string) => Promise<boolean>, sync: (id: string) => Promise<void>) {
  let done = 0;
  let failed = 0;
  for (const id of ids) {
    if (!rebuild && !(await needs(id))) continue;
    try {
      await sync(id);
      done++;
    } catch (error) {
      failed++;
      console.error(`  ${label} ${id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`${label}: ${done} dijurnal${failed ? `, ${failed} gagal` : ""}`);
}

async function main() {
  await seedCoa();
  await linkLegacyPosIncome();

  const funds = await prisma.fundRequest.findMany({
    where: { status: { in: ["PAID", "REALIZED"] } },
    select: { id: true, status: true },
  });
  await run(
    "Pengajuan dana",
    funds.map((f) => f.id),
    async (id) => {
      const fund = funds.find((f) => f.id === id)!;
      if (!(await hasJournal("FUND_PAYMENT", id))) return true;
      return fund.status === "REALIZED" && !(await hasJournal("FUND_REALIZATION", id));
    },
    (id) => prisma.$transaction((tx) => syncFundRequestJournals(tx, id))
  );

  const invoices = await prisma.invoice.findMany({
    where: { docType: "INVOICE", status: { in: ["ISSUED", "PAID"] } },
    select: { id: true },
  });
  await run(
    "Piutang invoice",
    invoices.map((i) => i.id),
    async (id) => !(await hasJournal("INVOICE", id)),
    (id) => prisma.$transaction((tx) => syncInvoiceJournal(tx, id))
  );

  const incomes = await prisma.incomeEntry.findMany({ select: { id: true } });
  await run(
    "Pendapatan",
    incomes.map((i) => i.id),
    async (id) => !(await hasJournal("INCOME", id)),
    (id) => prisma.$transaction((tx) => syncIncomeJournal(tx, id))
  );

  const posExpenses = await prisma.posTransaction.findMany({ where: { type: "EXPENSE" }, select: { id: true } });
  await run(
    "Pengeluaran POS",
    posExpenses.map((p) => p.id),
    async (id) => !(await hasJournal("POS_EXPENSE", id)),
    (id) => prisma.$transaction((tx) => syncPosJournal(tx, id))
  );

  const postings = await prisma.payrollPosting.findMany({ select: { id: true, year: true, month: true, company: true } });
  await run(
    "Payroll",
    postings.map((p) => p.id),
    async (id) => !(await hasJournal("PAYROLL", id)),
    (id) => prisma.$transaction((tx) => syncPayrollJournal(tx, id))
  );

  const periods = new Map<string, string[]>();
  for (const p of postings) {
    const key = `${p.year}-${p.month}`;
    periods.set(key, [...(periods.get(key) ?? []), p.company]);
  }
  for (const [key, companies] of periods) {
    if (companies.includes("ALL") && companies.length > 1) {
      console.warn(`PERINGATAN payroll ${key}: ada posting ALL dan per perusahaan (${companies.join(", ")}) — cek dobel`);
    }
  }

  const entries = await prisma.journalEntry.count();
  const totals = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  console.log(
    `Total jurnal: ${entries} | debit ${totals._sum.debit ?? 0} | kredit ${totals._sum.credit ?? 0}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
