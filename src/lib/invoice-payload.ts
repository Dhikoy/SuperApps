import {
  type FinanceDocType,
} from "@/lib/invoice";
import { terbilangKwitansi, terbilangRupiah } from "@/lib/terbilang";

const DOC_TYPES = new Set<FinanceDocType>(["INVOICE", "FUND_REQUEST", "RECEIPT"]);
const PAYMENT_METHODS = new Set(["BANK_TRANSFER", "CASH", "E_WALLET", "ATM"]);

export type ParsedInvoiceItem = {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  subtotal: number;
  sortOrder: number;
};

export type ParsedInvoice = {
  docType: FinanceDocType;
  company: string;
  issueDate: Date;
  subject: string;
  notes: string;
  customerName: string;
  customerAddress: string;
  receivedFrom: string;
  paymentFor: string;
  paymentMethod: "BANK_TRANSFER" | "CASH" | "E_WALLET" | "ATM" | null;
  paymentSource: string;
  paymentDestination: string;
  items: ParsedInvoiceItem[];
  subtotal: number;
  totalAmount: number;
  amountInWords: string;
  dueDate: Date | null;
  accountCode: string | null;
  /** Hanya field yang diisi; sisanya pakai default / nilai lama */
  signatories: Partial<Record<SignatoryField, string>>;
};

const SIGNATORY_FIELDS = ["preparedByName", "preparedByTitle", "approvedByName", "approvedByTitle"] as const;
type SignatoryField = (typeof SIGNATORY_FIELDS)[number];

export function parseInvoicePayload(body: Record<string, unknown>): { error: string } | ParsedInvoice {
  const docType = String(body.docType ?? "").toUpperCase() as FinanceDocType;
  const company = String(body.company ?? "")
    .trim()
    .toUpperCase();
  const issueDateRaw = body.issueDate as string | undefined;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerAddress =
    typeof body.customerAddress === "string" ? body.customerAddress.trim() : "";
  const receivedFrom = typeof body.receivedFrom === "string" ? body.receivedFrom.trim() : "";
  const paymentFor = typeof body.paymentFor === "string" ? body.paymentFor.trim() : "";
  const paymentMethod =
    typeof body.paymentMethod === "string" && PAYMENT_METHODS.has(body.paymentMethod)
      ? (body.paymentMethod as ParsedInvoice["paymentMethod"])
      : null;
  const paymentSource =
    typeof body.paymentSource === "string" ? body.paymentSource.trim() : "";
  const paymentDestination =
    typeof body.paymentDestination === "string" ? body.paymentDestination.trim() : "";

  if (!DOC_TYPES.has(docType)) {
    return { error: "Pilih tipe dokumen: Invoice, Pengajuan Dana, atau Kwitansi" };
  }
  if (!company || !issueDateRaw) {
    return { error: "Perusahaan dan tanggal wajib diisi" };
  }

  const issueDate = new Date(issueDateRaw);
  if (Number.isNaN(issueDate.getTime())) {
    return { error: "Tanggal tidak valid" };
  }

  let dueDate: Date | null = null;
  if (docType === "INVOICE" && typeof body.dueDate === "string" && body.dueDate.trim()) {
    dueDate = new Date(body.dueDate);
    if (Number.isNaN(dueDate.getTime())) return { error: "Tanggal jatuh tempo tidak valid" };
    if (dueDate.getTime() < issueDate.getTime()) {
      return { error: "Jatuh tempo tidak boleh sebelum tanggal invoice" };
    }
  }
  const accountCode =
    docType !== "FUND_REQUEST" && typeof body.accountCode === "string" && body.accountCode.trim()
      ? body.accountCode.trim()
      : null;

  if (docType === "INVOICE" && !customerName) {
    return { error: "Nama klien wajib untuk Invoice" };
  }
  if (docType === "RECEIPT" && !receivedFrom) {
    return { error: "Sudah terima dari wajib untuk Kwitansi" };
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((raw, idx) => {
      const it = raw as {
        description?: string;
        quantity?: number;
        unit?: string;
        unitPrice?: number;
      };
      const description = String(it.description ?? "").trim();
      const quantity = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      if (!description || !(quantity > 0) || !(unitPrice >= 0)) return null;
      return {
        description,
        quantity,
        unit: it.unit?.trim() || null,
        unitPrice,
        subtotal: quantity * unitPrice,
        sortOrder: idx,
      };
    })
    .filter(Boolean) as ParsedInvoiceItem[];

  let subtotal = items.reduce((s, it) => s + it.subtotal, 0);
  let totalAmount = subtotal;

  if (docType === "RECEIPT" && items.length === 0) {
    totalAmount = Number(body.totalAmount);
    if (!(totalAmount > 0)) {
      return { error: "Nominal kwitansi wajib diisi" };
    }
    subtotal = totalAmount;
  } else if (items.length === 0) {
    return { error: "Minimal satu baris item" };
  }

  const signatories: Partial<Record<SignatoryField, string>> = {};
  for (const field of SIGNATORY_FIELDS) {
    const value = typeof body[field] === "string" ? (body[field] as string).trim().slice(0, 80) : "";
    if (value) signatories[field] = value;
  }

  const amountInWords =
    docType === "RECEIPT" ? terbilangKwitansi(totalAmount) : terbilangRupiah(totalAmount);

  return {
    docType,
    company,
    issueDate,
    subject,
    notes,
    customerName,
    customerAddress,
    receivedFrom,
    paymentFor,
    paymentMethod,
    paymentSource,
    paymentDestination,
    items,
    subtotal,
    totalAmount,
    amountInWords,
    dueDate,
    accountCode,
    signatories,
  };
}
