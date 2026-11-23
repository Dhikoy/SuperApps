import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import {
  DEFAULT_SIGNATORIES,
  formatFinanceDocNumber,
  type FinanceDocType,
} from "@/lib/invoice";
import { resolveLetterheadName } from "@/lib/invoice-company";
import { parseInvoicePayload } from "@/lib/invoice-payload";
import { assertAccount } from "@/lib/accounting/journal";
import { journalErrorResponse } from "@/lib/accounting/http";

const DOC_TYPES = new Set<FinanceDocType>(["INVOICE", "FUND_REQUEST", "RECEIPT"]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = request.nextUrl.searchParams.get("company")?.toUpperCase() || undefined;
  const docType = request.nextUrl.searchParams.get("docType") || undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(company ? { company } : {}),
      ...(docType && DOC_TYPES.has(docType as FinanceDocType)
        ? { docType: docType as FinanceDocType }
        : {}),
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = parseInvoicePayload(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const yearStart = new Date(parsed.issueDate.getFullYear(), 0, 1);
  const yearEnd = new Date(parsed.issueDate.getFullYear() + 1, 0, 1);
  const countThisYear = await prisma.invoice.count({
    where: {
      docType: parsed.docType,
      issueDate: { gte: yearStart, lt: yearEnd },
    },
  });

  const invoiceNumber = formatFinanceDocNumber({
    docType: parsed.docType,
    company: parsed.company,
    issueDate: parsed.issueDate,
    sequence: countThisYear + 1,
  });

  let accountCode: string | null;
  try {
    accountCode = await assertAccount(prisma, parsed.accountCode, { label: "Akun pendapatan", groups: ["REVENUE"] });
  } catch (error) {
    return journalErrorResponse(error);
  }

  const invoice = await prisma.invoice.create({
    data: {
      accountCode,
      dueDate: parsed.dueDate,
      docType: parsed.docType,
      invoiceNumber,
      company: parsed.company,
      companyFullName: await resolveLetterheadName(parsed.company),
      customerName: parsed.customerName || null,
      customerAddress: parsed.customerAddress || null,
      receivedFrom: parsed.receivedFrom || null,
      paymentFor: parsed.paymentFor || parsed.subject || null,
      subject: parsed.subject || null,
      issueDate: parsed.issueDate,
      status: "DRAFT",
      subtotal: parsed.subtotal,
      taxAmount: 0,
      totalAmount: parsed.totalAmount,
      amountInWords: parsed.amountInWords,
      notes: parsed.notes || null,
      paymentMethod: parsed.paymentMethod,
      paymentSource: parsed.paymentSource || null,
      paymentDestination: parsed.paymentDestination || null,
      ...DEFAULT_SIGNATORIES,
      ...parsed.signatories,
      createdBy: session.nik,
      items: parsed.items.length ? { create: parsed.items } : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
