import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { buildInvoicePdf, invoicePdfFilename } from "@/lib/invoice-pdf";
import { FINANCE_DOC_TYPE_LABELS } from "@/lib/invoice";
import { resolveLetterheadName } from "@/lib/invoice-company";
import { parseInvoicePayload } from "@/lib/invoice-payload";
import { journalErrorResponse } from "@/lib/accounting/http";
import {
  assertAccount,
  deleteSourceJournal,
  JournalError,
  syncIncomeJournal,
  syncInvoiceJournal,
} from "@/lib/accounting/journal";

type Ctx = { params: Promise<{ id: string }> };

function parsePaidDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!inv) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  if (inv.status === "DRAFT") {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({ where: { id }, data: { status: "ISSUED" } });
        await syncInvoiceJournal(tx, id);
      });
      inv.status = "ISSUED";
    } catch (error) {
      if (!(error instanceof JournalError)) throw error;
    }
  }

  const doc = buildInvoicePdf(inv);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = invoicePdfFilename(inv);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Sync Invoice/Kwitansi → Pendapatan (IncomeEntry). Invoice: pelunasan piutang; Kwitansi: pendapatan tunai. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  if (inv.docType === "FUND_REQUEST") {
    return NextResponse.json(
      { error: "Pengajuan Dana tidak di-sync ke pendapatan (bukan pemasukan)" },
      { status: 400 }
    );
  }

  if (inv.syncedIncomeId) {
    return NextResponse.json({
      ok: true,
      alreadySynced: true,
      message: "Sudah pernah di-sync ke pendapatan",
      incomeId: inv.syncedIncomeId,
    });
  }

  if (!(inv.totalAmount > 0)) {
    return NextResponse.json({ error: "Total dokumen masih 0 — tidak bisa sync" }, { status: 400 });
  }

  const typeLabel = FINANCE_DOC_TYPE_LABELS[inv.docType] ?? inv.docType;
  const title = `${typeLabel} ${inv.invoiceNumber}${
    inv.customerName || inv.receivedFrom ? ` — ${inv.customerName || inv.receivedFrom}` : ""
  }`;

  const body = await request.json().catch(() => ({}));
  const paidDate = parsePaidDate(body.paidDate) ?? (inv.docType === "INVOICE" ? new Date() : inv.issueDate);

  let income;
  let updated;
  try {
    ({ income, updated } = await prisma.$transaction(async (tx) => {
      const accountCode =
        (await assertAccount(tx, typeof body.accountCode === "string" ? body.accountCode : null, {
          label: "Akun pendapatan",
          groups: ["REVENUE"],
        })) ?? inv.accountCode;
      const cashAccount = await assertAccount(tx, typeof body.cashAccount === "string" ? body.cashAccount : null, {
        label: "Masuk ke",
        cash: true,
      });
      const income = await tx.incomeEntry.create({
        data: {
          title: title.slice(0, 200),
          company: inv.company,
          amount: inv.totalAmount,
          source: "MANUAL",
          entryDate: paidDate,
          remarks: `Sync dari ${typeLabel} ${inv.invoiceNumber} (id:${inv.id})`,
          createdBy: session.nik,
          accountCode,
          cashAccount,
        },
      });
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          syncedIncomeId: income.id,
          syncedAt: new Date(),
          status: "PAID",
          ...(accountCode && !inv.accountCode ? { accountCode } : {}),
        },
        include: { items: true },
      });
      await syncInvoiceJournal(tx, id);
      return { income, updated };
    }));
  } catch (error) {
    return journalErrorResponse(error);
  }

  return NextResponse.json({
    ok: true,
    message: inv.docType === "INVOICE" ? "Pelunasan invoice tercatat (piutang ditutup)" : "Berhasil sync ke pendapatan",
    incomeId: income.id,
    invoice: updated,
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  const body = await request.json();
  const parsed = parseInvoicePayload(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const companyFullName = await resolveLetterheadName(parsed.company);
  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const accountCode = await assertAccount(tx, parsed.accountCode, { label: "Akun pendapatan", groups: ["REVENUE"] });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      const invoice = await tx.invoice.update({
        where: { id },
        data: {
          docType: parsed.docType,
          company: parsed.company,
          companyFullName,
          ...parsed.signatories,
          customerName: parsed.customerName || null,
          customerAddress: parsed.customerAddress || null,
          receivedFrom: parsed.receivedFrom || null,
          paymentFor: parsed.paymentFor || parsed.subject || null,
          subject: parsed.subject || null,
          issueDate: parsed.issueDate,
          dueDate: parsed.dueDate,
          ...("accountCode" in body ? { accountCode } : {}),
          subtotal: parsed.subtotal,
          totalAmount: parsed.totalAmount,
          amountInWords: parsed.amountInWords,
          notes: parsed.notes || null,
          paymentMethod: parsed.paymentMethod,
          paymentSource: parsed.paymentSource || null,
          paymentDestination: parsed.paymentDestination || null,
          items: parsed.items.length ? { create: parsed.items } : undefined,
        },
        include: { items: true },
      });

      if (existing.syncedIncomeId && parsed.docType !== "FUND_REQUEST") {
        const typeLabel = FINANCE_DOC_TYPE_LABELS[parsed.docType] ?? parsed.docType;
        const title = `${typeLabel} ${existing.invoiceNumber}${
          parsed.customerName || parsed.receivedFrom ? ` — ${parsed.customerName || parsed.receivedFrom}` : ""
        }`;
        await tx.incomeEntry.updateMany({
          where: { id: existing.syncedIncomeId },
          data: {
            title: title.slice(0, 200),
            company: parsed.company,
            amount: parsed.totalAmount,
            ...(parsed.docType === "RECEIPT" ? { entryDate: parsed.issueDate } : {}),
          },
        });
        await syncIncomeJournal(tx, existing.syncedIncomeId);
      }
      await syncInvoiceJournal(tx, id);
      return invoice;
    });
    return NextResponse.json(invoice);
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await deleteSourceJournal(tx, "INVOICE", id);
      if (existing.syncedIncomeId) {
        await deleteSourceJournal(tx, "INCOME", existing.syncedIncomeId);
        await tx.incomeEntry.deleteMany({ where: { id: existing.syncedIncomeId } });
      }
      await tx.invoice.delete({ where: { id } });
    });
  } catch (error) {
    return journalErrorResponse(error);
  }

  return NextResponse.json({ ok: true });
}
