import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatRupiah } from "@/lib/payroll-policy";
import {
  FINANCE_DOC_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinanceDocType,
} from "@/lib/invoice";

export type InvoicePdfData = {
  docType: string;
  invoiceNumber: string;
  company: string;
  companyFullName: string | null;
  customerName: string | null;
  customerAddress: string | null;
  receivedFrom: string | null;
  paymentFor: string | null;
  subject: string | null;
  issueDate: Date | string;
  status: string;
  subtotal: number;
  totalAmount: number;
  amountInWords: string | null;
  notes: string | null;
  paymentMethod: string | null;
  paymentSource: string | null;
  paymentDestination: string | null;
  preparedByName: string;
  preparedByTitle: string;
  approvedByName: string;
  approvedByTitle: string;
  items: {
    description: string;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    subtotal: number;
  }[];
};

function dateId(d: Date | string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildInvoicePdf(inv: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const docType = inv.docType as FinanceDocType;
  const title = FINANCE_DOC_TYPE_LABELS[docType] ?? inv.docType;
  const kop = inv.companyFullName || inv.company;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(kop, 105, 18, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`(${inv.company})`, 105, 24, { align: "center" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 105, 36, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 46;
  doc.text(`No: ${inv.invoiceNumber}`, 14, y);
  y += 6;
  doc.text(`Tanggal: ${dateId(inv.issueDate)}`, 14, y);
  y += 6;

  if (inv.subject) {
    doc.text(`Perihal: ${inv.subject}`, 14, y);
    y += 6;
  }

  if (docType === "INVOICE") {
    doc.text(`Kepada: ${inv.customerName ?? "—"}`, 14, y);
    y += 6;
    if (inv.customerAddress) {
      doc.text(`Alamat: ${inv.customerAddress}`, 14, y);
      y += 6;
    }
  }

  if (docType === "RECEIPT") {
    doc.text(`Sudah terima dari: ${inv.receivedFrom ?? "—"}`, 14, y);
    y += 6;
    doc.text(`Uang sejumlah: ${formatRupiah(inv.totalAmount)}`, 14, y);
    y += 6;
    doc.text(`Terbilang: ${inv.amountInWords ?? "—"}`, 14, y);
    y += 6;
    doc.text(`Untuk pembayaran: ${inv.paymentFor || inv.subject || "—"}`, 14, y);
    y += 8;
  }

  if (inv.items.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      tableWidth: 182,
      head: [["No", "Deskripsi", "Qty", "Harga", "Subtotal"]],
      body: inv.items.map((it, i) => [
        String(i + 1),
        it.description,
        String(it.quantity),
        formatRupiah(it.unitPrice),
        formatRupiah(it.subtotal),
      ]),
      styles: { fontSize: 10, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [80, 50, 0], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 78 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 36, halign: "right" },
        4: { cellWidth: 36, halign: "right" },
      },
    });
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
  }

  if (docType !== "RECEIPT" || inv.items.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${formatRupiah(inv.totalAmount)}`, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const terbilangLines = doc.splitTextToSize(`Terbilang: ${inv.amountInWords ?? "—"}`, 182);
    doc.text(terbilangLines, 14, y);
    y += terbilangLines.length * 5 + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Rincian Pembayaran", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(
    `Metode: ${inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] ?? inv.paymentMethod : "—"}`,
    14,
    y
  );
  y += 5;
  doc.text(`Sumber: ${inv.paymentSource || "—"}`, 14, y);
  y += 5;
  const destLines = doc.splitTextToSize(`Tujuan: ${inv.paymentDestination || "—"}`, 182);
  doc.text(destLines, 14, y);
  y += destLines.length * 5 + 4;

  if (inv.notes) {
    const noteLines = doc.splitTextToSize(`Catatan: ${inv.notes}`, 182);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 5 + 8;
  }

  // Tanda tangan di bawah konten, lebar penuh (bukan dipaksa ke bawah halaman)
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 42) {
    doc.addPage();
    y = 20;
  }
  const sigY = y + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Dibuat Oleh", 14, sigY);
  doc.text("Disetujui Oleh", 120, sigY);
  doc.setFontSize(9);
  doc.text(inv.preparedByTitle, 14, sigY + 5);
  doc.text(inv.approvedByTitle, 120, sigY + 5);
  doc.setFontSize(10);
  doc.text(`(${inv.preparedByName})`, 14, sigY + 22);
  doc.text(`(${inv.approvedByName})`, 120, sigY + 22);

  return doc;
}

export function invoicePdfFilename(inv: { invoiceNumber: string; docType: string }) {
  const safe = inv.invoiceNumber.replace(/[\/\\]/g, "-");
  const prefix =
    inv.docType === "RECEIPT" ? "kwitansi" : inv.docType === "FUND_REQUEST" ? "pengajuan-dana" : "invoice";
  return `${prefix}-${safe}.pdf`;
}
