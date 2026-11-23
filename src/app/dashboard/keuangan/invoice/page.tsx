"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { INPUT_CLASS, StatusBadge } from "@/components/ui";
import { formatRupiah } from "@/lib/payroll-policy";
import {
  COMPANY_LETTERHEADS,
  DEFAULT_SIGNATORIES,
  FINANCE_DOC_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinanceDocType,
} from "@/lib/invoice";
import { terbilangKwitansi, terbilangRupiah } from "@/lib/terbilang";
import { AccountSelect } from "@/components/accounting/AccountSelect";
import { DEFAULT_ACCOUNTS } from "@/lib/accounting/constants";

type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceRow = {
  id: string;
  docType: string;
  invoiceNumber: string;
  company: string;
  companyFullName: string | null;
  customerName: string | null;
  customerAddress: string | null;
  receivedFrom: string | null;
  paymentFor: string | null;
  subject: string | null;
  notes: string | null;
  issueDate: string;
  status: string;
  totalAmount: number;
  amountInWords: string | null;
  paymentMethod: string | null;
  paymentSource: string | null;
  paymentDestination: string | null;
  syncedIncomeId: string | null;
  syncedAt: string | null;
  accountCode: string | null;
  dueDate: string | null;
  items: InvoiceItem[];
  preparedByName: string;
  preparedByTitle: string;
  approvedByName: string;
  approvedByTitle: string;
};

type Signatories = Pick<InvoiceRow, "preparedByName" | "preparedByTitle" | "approvedByName" | "approvedByTitle">;

type Letterhead = { code: string; name: string };

const FALLBACK_LETTERHEADS: Letterhead[] = Object.entries(COMPANY_LETTERHEADS)
  .filter(([code]) => code !== "ZEN EO")
  .map(([code, name]) => ({ code, name }));

type DraftItem = { description: string; quantity: string; unitPrice: string };

function emptyItem(): DraftItem {
  return { description: "", quantity: "1", unitPrice: "" };
}

function lineAmount(item: DraftItem) {
  const q = Number(item.quantity);
  const p = Number(item.unitPrice);
  if (!(q > 0) || !(p >= 0) || Number.isNaN(p)) return 0;
  return q * p;
}

export default function InvoicePage() {
  const [docType, setDocType] = useState<FinanceDocType>("INVOICE");
  const [company, setCompany] = useState("BCI");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentFor, setPaymentFor] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentSource, setPaymentSource] = useState("");
  const [paymentDestination, setPaymentDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [accountCode, setAccountCode] = useState<string>(DEFAULT_ACCOUNTS.income);
  const [dueDate, setDueDate] = useState("");
  const [syncTarget, setSyncTarget] = useState<{
    row: InvoiceRow;
    accountCode: string;
    cashAccount: string;
    paidDate: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const [letterheads, setLetterheads] = useState<Letterhead[]>(FALLBACK_LETTERHEADS);
  const [signers, setSigners] = useState<Signatories>({ ...DEFAULT_SIGNATORIES });
  const signersTouched = useRef(false);

  const itemsTotal = useMemo(() => items.reduce((sum, it) => sum + lineAmount(it), 0), [items]);

  const receiptTotal = Number(receiptAmount) || 0;
  const hasItemDetail = items.some((it) => it.description.trim());
  const previewTotal =
    docType === "RECEIPT"
      ? hasItemDetail
        ? itemsTotal || receiptTotal
        : receiptTotal || itemsTotal
      : itemsTotal;

  const previewTerbilang =
    docType === "RECEIPT" ? terbilangKwitansi(previewTotal) : terbilangRupiah(previewTotal);

  function load() {
    fetch("/api/finance/invoices")
      .then((r) => r.json())
      .then((d) => {
        const list: InvoiceRow[] = Array.isArray(d) ? d : [];
        setRows(list);
        const latest = list[0];
        if (latest && !signersTouched.current) {
          setSigners({
            preparedByName: latest.preparedByName,
            preparedByTitle: latest.preparedByTitle,
            approvedByName: latest.approvedByName,
            approvedByTitle: latest.approvedByTitle,
          });
        }
      })
      .catch(() => setRows([]));
  }

  useEffect(() => {
    load();
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setLetterheads(d.map((c: Letterhead) => ({ code: c.code, name: c.name || c.code })));
        }
      })
      .catch(() => {});
  }, []);

  const letterheadOptions = letterheads.some((l) => l.code === company)
    ? letterheads
    : [...letterheads, { code: company, name: COMPANY_LETTERHEADS[company] ?? company }];
  const letterheadName = letterheadOptions.find((l) => l.code === company)?.name ?? company;

  function openPdf(id: string) {
    window.open(`/api/finance/invoices/${id}`, "_blank");
    setTimeout(load, 800);
  }

  function openSync(row: InvoiceRow) {
    setActionMsg("");
    setSyncTarget({
      row,
      accountCode: row.accountCode ?? DEFAULT_ACCOUNTS.income,
      cashAccount: DEFAULT_ACCOUNTS.cash,
      paidDate: row.docType === "INVOICE" ? toDateInput(new Date().toISOString()) : toDateInput(row.issueDate),
    });
  }

  async function confirmSync() {
    if (!syncTarget) return;
    setSyncing(true);
    const res = await fetch(`/api/finance/invoices/${syncTarget.row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountCode: syncTarget.accountCode,
        cashAccount: syncTarget.cashAccount,
        paidDate: syncTarget.paidDate,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setActionMsg(typeof data.error === "string" ? data.error : "Sync gagal");
      return;
    }
    setSyncTarget(null);
    setActionMsg(data.message ?? "Sync berhasil");
    load();
  }

  function resetForm() {
    setEditingId(null);
    setEditingNumber("");
    setSubject("");
    setCustomerName("");
    setCustomerAddress("");
    setReceivedFrom("");
    setPaymentFor("");
    setReceiptAmount("");
    setItems([emptyItem()]);
    setPaymentSource("");
    setPaymentDestination("");
    setAccountCode(DEFAULT_ACCOUNTS.income);
    setDueDate("");
    setNotes("");
    setError("");
  }

  function toDateInput(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function startEdit(r: InvoiceRow) {
    const loaded = (r.items ?? []).map((it) => ({
      description: it.description,
      quantity: String(it.quantity),
      unitPrice: String(it.unitPrice),
    }));
    setEditingId(r.id);
    setEditingNumber(r.invoiceNumber);
    setDocType((r.docType as FinanceDocType) || "INVOICE");
    setCompany(r.company);
    setIssueDate(toDateInput(r.issueDate));
    setSubject(r.subject ?? "");
    setCustomerName(r.customerName ?? "");
    setCustomerAddress(r.customerAddress ?? "");
    setReceivedFrom(r.receivedFrom ?? "");
    setPaymentFor(r.paymentFor ?? "");
    setNotes(r.notes ?? "");
    setPaymentMethod(r.paymentMethod ?? "BANK_TRANSFER");
    setPaymentSource(r.paymentSource ?? "");
    setPaymentDestination(r.paymentDestination ?? "");
    setAccountCode(r.accountCode ?? DEFAULT_ACCOUNTS.income);
    setDueDate(r.dueDate ? toDateInput(r.dueDate) : "");
    setItems(loaded.length > 0 ? loaded : [emptyItem()]);
    signersTouched.current = true;
    setSigners({
      preparedByName: r.preparedByName,
      preparedByTitle: r.preparedByTitle,
      approvedByName: r.approvedByName,
      approvedByTitle: r.approvedByTitle,
    });
    setReceiptAmount(r.docType === "RECEIPT" ? String(r.totalAmount) : "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(r: InvoiceRow) {
    const extra = r.syncedIncomeId ? " Pendapatan yang sudah di-sync ikut terhapus." : "";
    if (!confirm(`Hapus ${r.invoiceNumber}?${extra}`)) return;
    setActionMsg("");
    const res = await fetch(`/api/finance/invoices/${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMsg(typeof data.error === "string" ? data.error : "Gagal menghapus");
      return;
    }
    if (editingId === r.id) resetForm();
    setActionMsg("Dokumen dihapus");
    load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payloadItems = items
      .filter((it) => it.description.trim() && Number(it.quantity) > 0)
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice) || 0,
      }));

    const res = await fetch(editingId ? `/api/finance/invoices/${editingId}` : "/api/finance/invoices", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docType,
        company,
        issueDate,
        subject,
        notes,
        customerName,
        customerAddress,
        receivedFrom,
        paymentFor: paymentFor || subject,
        totalAmount: Number(receiptAmount) || undefined,
        paymentMethod,
        paymentSource,
        paymentDestination,
        accountCode,
        dueDate: docType === "INVOICE" ? dueDate : "",
        items: payloadItems,
        ...signers,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Gagal menyimpan");
      setLoading(false);
      return;
    }

    resetForm();
    load();
    setLoading(false);
  }

  return (
    <div className="w-full max-w-none space-y-6 px-1 sm:px-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoice &amp; Dokumen Keuangan</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Sesuai spek Detailing Invoice — pilih Invoice, Pengajuan Dana, atau Kwitansi
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
        {editingId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>
              Mode edit <span className="font-mono">{editingNumber}</span> — nomor dokumen tidak berubah
            </span>
            <button type="button" onClick={resetForm} className="font-semibold underline">
              Batal
            </button>
          </div>
        )}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tipe dokumen
          </label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(FINANCE_DOC_TYPE_LABELS) as FinanceDocType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDocType(t)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  docType === t
                    ? "border-[#503200] bg-[#503200] text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#503200]/40"
                }`}
              >
                {FINANCE_DOC_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500">KOP Perusahaan</label>
              <a href="/dashboard/hr/pt" className="text-xs font-medium text-[#503200] hover:underline">
                Ubah nama KOP
              </a>
            </div>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={INPUT_CLASS}
              required
            >
              {letterheadOptions.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Tanggal dibuat</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>
          {docType !== "FUND_REQUEST" && (
            <div>
              <label className="text-xs font-semibold text-slate-500">Akun pendapatan</label>
              <AccountSelect value={accountCode} onChange={setAccountCode} groups={["REVENUE"]} />
            </div>
          )}
          {docType === "INVOICE" && (
            <div>
              <label className="text-xs font-semibold text-slate-500">Jatuh tempo (opsional)</label>
              <input
                type="date"
                value={dueDate}
                min={issueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
          KOP: <strong>{letterheadName}</strong>
          <span className="text-slate-400"> · </span>
          Nomor otomatis saat simpan (format{" "}
          {docType === "RECEIPT"
            ? "001/KEU/MM/YYYY"
            : docType === "FUND_REQUEST"
              ? "001/PD/PT/Romawi/YYYY"
              : "001/INV/PT/Romawi/YYYY"}
          )
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">Perihal</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Diisi kebutuhan invoice / dokumen"
          />
        </div>

        {docType === "INVOICE" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Nama klien</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="PT / nama klien"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Alamat klien (opsional)</label>
              <input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Alamat"
              />
            </div>
          </div>
        )}

        {docType === "RECEIPT" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Sudah terima dari</label>
              <input
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                className={INPUT_CLASS}
                placeholder="PT. ..."
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Untuk pembayaran</label>
              <input
                value={paymentFor}
                onChange={(e) => setPaymentFor(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Keterangan pembayaran"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500">
                Uang sejumlah (Rp) — jika tanpa rincian item
              </label>
              <input
                type="number"
                min="1"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                className={INPUT_CLASS}
                placeholder="5000000"
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Isi item{docType === "RECEIPT" ? " (opsional jika nominal diisi)" : ""}
            </p>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="inline-flex items-center gap-1 rounded-lg bg-[#503200] px-3 py-1.5 text-sm font-semibold text-white"
            >
              + Tambah item
            </button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Item {idx + 1}</p>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-xs font-medium text-red-600"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                <input
                  value={item.description}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, description: e.target.value } : row))
                    )
                  }
                  className={`${INPUT_CLASS} sm:col-span-3`}
                  placeholder="Deskripsi"
                />
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, quantity: e.target.value } : row))
                    )
                  }
                  className={INPUT_CLASS}
                  placeholder="Qty"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.unitPrice}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, unitPrice: e.target.value } : row))
                    )
                  }
                  className={`${INPUT_CLASS} sm:col-span-2`}
                  placeholder="Harga"
                />
              </div>
              <p className="text-sm text-slate-600">
                Subtotal baris: <strong>{formatRupiah(lineAmount(item))}</strong>
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-slate-800">
            TOTAL: {formatRupiah(previewTotal || 0)}
          </p>
          <p className="text-sm text-slate-600">
            Terbilang: <em>{previewTerbilang || "—"}</em>
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rincian pembayaran
          </p>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={INPUT_CLASS}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={paymentSource}
              onChange={(e) => setPaymentSource(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Sumber"
            />
            <input
              value={paymentDestination}
              onChange={(e) => setPaymentDestination(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Tujuan (rekening / penerima)"
            />
          </div>
        </div>

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={INPUT_CLASS}
          placeholder="Catatan tambahan (opsional)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          {([
            ["Dibuat Oleh", "preparedByName", "preparedByTitle"],
            ["Disetujui Oleh", "approvedByName", "approvedByTitle"],
          ] as const).map(([heading, nameKey, titleKey]) => (
            <div key={heading} className="space-y-2">
              <p className="font-semibold text-slate-800">{heading}</p>
              <input
                value={signers[nameKey]}
                onChange={(e) => {
                  signersTouched.current = true;
                  setSigners({ ...signers, [nameKey]: e.target.value });
                }}
                className={INPUT_CLASS}
                placeholder="Nama"
                maxLength={80}
                required
              />
              <input
                value={signers[titleKey]}
                onChange={(e) => {
                  signersTouched.current = true;
                  setSigners({ ...signers, [titleKey]: e.target.value });
                }}
                className={INPUT_CLASS}
                placeholder="Jabatan"
                maxLength={80}
                required
              />
            </div>
          ))}
          <p className="sm:col-span-2 text-xs text-slate-400">
            Nama & jabatan penandatangan bisa diganti per dokumen; dokumen baru otomatis memakai nama dari dokumen terakhir.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? "Menyimpan..."
            : editingId
              ? `Simpan perubahan ${FINANCE_DOC_TYPE_LABELS[docType]}`
              : `Simpan ${FINANCE_DOC_TYPE_LABELS[docType]}`}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Daftar dokumen</h2>
          {actionMsg && <p className="text-xs text-slate-600">{actionMsg}</p>}
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada dokumen</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-900 break-all">
                        {r.invoiceNumber}
                      </p>
                      <p className="text-sm font-medium text-slate-800 mt-1">
                        {FINANCE_DOC_TYPE_LABELS[r.docType as FinanceDocType] ?? r.docType}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(r.issueDate).toLocaleDateString("id-ID")} · {r.company}
                      </p>
                      <p className="text-xs text-slate-500 break-words">
                        {r.customerName || r.receivedFrom || r.subject || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <StatusBadge status={r.status} />
                      <p className="text-sm font-semibold text-slate-900">
                        {formatRupiah(r.totalAmount)}
                      </p>
                      {r.syncedAt && (
                        <p className="text-[10px] text-emerald-600">Synced</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPdf(r.id)}
                      className="rounded border border-[#503200] px-3 py-2 text-xs font-semibold text-[#503200] hover:bg-[#503200]/5"
                    >
                      Cetak
                    </button>
                    {r.docType !== "FUND_REQUEST" && (
                      <button
                        type="button"
                        onClick={() => openSync(r)}
                        disabled={!!r.syncedIncomeId}
                        className="rounded border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        {r.syncedIncomeId ? "Synced" : "Sync"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="bg-white text-left text-xs uppercase text-slate-500 border-b">
                    <th className="px-3 py-3">No</th>
                    <th className="px-3 py-3">Tipe</th>
                    <th className="px-3 py-3">Tanggal</th>
                    <th className="px-3 py-3">PT / Pihak</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                        {r.invoiceNumber}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {FINANCE_DOC_TYPE_LABELS[r.docType as FinanceDocType] ?? r.docType}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {new Date(r.issueDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-3 py-3 min-w-[10rem]">
                        <p className="font-medium">{r.company}</p>
                        <p className="text-xs text-slate-500 break-words">
                          {r.customerName || r.receivedFrom || r.subject || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={r.status} />
                        {r.syncedAt && (
                          <p className="text-[10px] text-emerald-600 mt-1">Synced pendapatan</p>
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium whitespace-nowrap">
                        {formatRupiah(r.totalAmount)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openPdf(r.id)}
                            className="rounded border border-[#503200] px-2.5 py-1 text-xs font-semibold text-[#503200] hover:bg-[#503200]/5"
                          >
                            Cetak
                          </button>
                          {r.docType !== "FUND_REQUEST" && (
                            <button
                              type="button"
                              onClick={() => openSync(r)}
                              disabled={!!r.syncedIncomeId}
                              className="rounded border border-emerald-700 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                            >
                              {r.syncedIncomeId ? "Synced" : "Sync"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {syncTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !syncing && setSyncTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-slate-900">
                {syncTarget.row.docType === "INVOICE" ? "Catat Pelunasan Invoice" : "Sync ke Pendapatan"}
              </h3>
              <p className="text-sm text-slate-500">
                {syncTarget.row.invoiceNumber} · {formatRupiah(syncTarget.row.totalAmount)} —{" "}
                {syncTarget.row.docType === "INVOICE"
                  ? "dijurnal Debit Kas/Bank, Kredit 110 Piutang Usaha (pendapatan sudah diakui saat invoice terbit)."
                  : "dijurnal Debit Kas/Bank, Kredit akun pendapatan."}
              </p>
            </div>
            {(syncTarget.row.docType !== "INVOICE" || !syncTarget.row.accountCode) && (
              <label className="block text-xs font-medium text-slate-600">
                Akun pendapatan
                <AccountSelect
                  value={syncTarget.accountCode}
                  onChange={(accountCode) => setSyncTarget({ ...syncTarget, accountCode })}
                  groups={["REVENUE"]}
                  className="input-field mt-1"
                />
              </label>
            )}
            <label className="block text-xs font-medium text-slate-600">
              Tanggal diterima
              <input
                type="date"
                value={syncTarget.paidDate}
                onChange={(e) => setSyncTarget({ ...syncTarget, paidDate: e.target.value })}
                className="input-field mt-1"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Masuk ke (Kas/Bank)
              <AccountSelect
                value={syncTarget.cashAccount}
                onChange={(cashAccount) => setSyncTarget({ ...syncTarget, cashAccount })}
                cashOnly
                className="input-field mt-1"
              />
            </label>
            {actionMsg && <p className="text-sm text-red-600">{actionMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSyncTarget(null)} disabled={syncing} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
                Batal
              </button>
              <button type="button" onClick={confirmSync} disabled={syncing} className="btn-primary">
                {syncing ? "Menyimpan…" : "Sync & Tandai Lunas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
