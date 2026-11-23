"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type Asset = {
  id: string;
  laptop: string;
  serialNumber: string;
  specification: string | null;
  warehouse: string;
  user: { name: string } | null;
};

type Employee = { nik: string; name: string; jobTitle: string | null; homeAddress: string | null };

type LoanItem = { id: string; assetId: string; assetName: string; serialNumber: string; specification: string | null };

type LoanStatus = "PENDING" | "ACTIVE" | "RETURNED";

type Loan = {
  id: string;
  number: string;
  borrowerId: string;
  borrowerName: string;
  jobTitle: string | null;
  homeAddress: string | null;
  contact: string | null;
  hrName: string;
  directorName: string;
  status: LoanStatus;
  signedPath: string | null;
  signedAt: string | null;
  signedBy: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
  createdAt: string;
  items: LoanItem[];
};

type FormItem = { assetId: string; specification: string };

type LoanForm = {
  borrowerId: string;
  jobTitle: string;
  homeAddress: string;
  contact: string;
  hrName: string;
  directorName: string;
  items: FormItem[];
};

const DEFAULT_DIRECTOR = "Putu Hadi Purnama Jati";

const STATUS_STYLE: Record<LoanStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending — belum upload form", className: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Dipinjam", className: "bg-emerald-100 text-emerald-800" },
  RETURNED: { label: "Dikembalikan", className: "bg-slate-200 text-slate-700" },
};

function emptyForm(hrName: string): LoanForm {
  return {
    borrowerId: "",
    jobTitle: "",
    homeAddress: "",
    contact: "",
    hrName,
    directorName: DEFAULT_DIRECTOR,
    items: [{ assetId: "", specification: "" }],
  };
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filenameFrom(res: Response, fallback: string) {
  const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

export function AssetLoanManager({ currentUserName }: { currentUserName: string }) {
  const { showToast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LoanForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | LoanStatus>("");
  const [query, setQuery] = useState("");

  function loadLoans() {
    return fetch("/api/assets/loans")
      .then((r) => r.json())
      .then((data) => setLoans(Array.isArray(data) ? data : []))
      .catch(() => showToast("Gagal memuat data peminjaman", "error"));
  }

  function loadAssets() {
    return fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    Promise.all([
      loadLoans(),
      loadAssets(),
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => setEmployees(Array.isArray(data) ? data : []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Aset yang sedang ada di form pending/aktif lain tidak bisa dipilih lagi. */
  const busyAssets = useMemo(() => {
    const map = new Map<string, string>();
    for (const loan of loans) {
      if (loan.status === "RETURNED" || loan.id === editingId) continue;
      for (const item of loan.items) map.set(item.assetId, `${loan.number} · ${loan.borrowerName}`);
    }
    return map;
  }, [loans, editingId]);

  const counts = useMemo(() => {
    const result: Record<LoanStatus, number> = { PENDING: 0, ACTIVE: 0, RETURNED: 0 };
    for (const loan of loans) result[loan.status] += 1;
    return result;
  }, [loans]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((loan) => {
      if (statusFilter && loan.status !== statusFilter) return false;
      if (!q) return true;
      return (
        loan.number.toLowerCase().includes(q) ||
        loan.borrowerName.toLowerCase().includes(q) ||
        loan.items.some((i) => i.assetName.toLowerCase().includes(q) || i.serialNumber.toLowerCase().includes(q))
      );
    });
  }, [loans, statusFilter, query]);

  function chooseBorrower(nik: string) {
    if (!form) return;
    const employee = employees.find((e) => e.nik === nik);
    const lastContact = loans.find((l) => l.borrowerId === nik && l.contact)?.contact ?? "";
    setForm({
      ...form,
      borrowerId: nik,
      jobTitle: employee?.jobTitle ?? "",
      homeAddress: employee?.homeAddress ?? "",
      contact: lastContact,
    });
  }

  function setItem(index: number, patch: Partial<FormItem>) {
    if (!form) return;
    setForm({ ...form, items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function chooseAsset(index: number, assetId: string) {
    const asset = assets.find((a) => a.id === assetId);
    setItem(index, { assetId, specification: asset?.specification ?? "" });
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm(currentUserName));
  }

  function startEdit(loan: Loan) {
    setEditingId(loan.id);
    setForm({
      borrowerId: loan.borrowerId,
      jobTitle: loan.jobTitle ?? "",
      homeAddress: loan.homeAddress ?? "",
      contact: loan.contact ?? "",
      hrName: loan.hrName,
      directorName: loan.directorName,
      items: loan.items.map((i) => ({ assetId: i.assetId, specification: i.specification ?? "" })),
    });
  }

  async function downloadForm(loan: Pick<Loan, "id" | "number">) {
    const res = await fetch(`/api/assets/loans/${loan.id}/form`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Gagal mengunduh form");
    }
    downloadBlob(await res.blob(), filenameFrom(res, `${loan.number}.docx`));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch(editingId ? `/api/assets/loans/${editingId}` : "/api/assets/loans", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Gagal menyimpan form", "error");
        return;
      }
      setLoans((rows) => [data, ...rows.filter((row) => row.id !== data.id)]);
      setForm(null);
      setEditingId(null);
      await downloadForm(data);
      showToast("Form Word terunduh. Cetak, tanda tangani, lalu unggah scan-nya.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal mengunduh form", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSigned(loan: Loan, file: File) {
    if (file.size > 8 * 1024 * 1024) {
      showToast("File maksimal 8 MB", "error");
      return;
    }
    setUploadFor(loan.id);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/assets/loans/${loan.id}/signed`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Gagal mengunggah form", "error");
        return;
      }
      setLoans((rows) => rows.map((row) => (row.id === data.id ? data : row)));
      showToast(loan.status === "PENDING" ? `Status ${loan.number} menjadi Dipinjam` : "Scan form diperbarui", "success");
      loadAssets();
    } finally {
      setUploadFor(null);
    }
  }

  async function cancelLoan(loan: Loan) {
    if (!confirm(`Batalkan form ${loan.number} untuk ${loan.borrowerName}?`)) return;
    const res = await fetch(`/api/assets/loans/${loan.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error ?? "Gagal membatalkan", "error");
      return;
    }
    setLoans((rows) => rows.filter((row) => row.id !== loan.id));
    showToast("Form dibatalkan", "success");
  }

  async function returnLoan(loan: Loan) {
    const note = prompt(`Tandai barang ${loan.number} sudah dikembalikan oleh ${loan.borrowerName}?\nCatatan kondisi (opsional):`, "");
    if (note === null) return;
    const res = await fetch(`/api/assets/loans/${loan.id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error ?? "Gagal menyimpan pengembalian", "error");
      return;
    }
    setLoans((rows) => rows.map((row) => (row.id === data.id ? data : row)));
    showToast("Barang tercatat sudah dikembalikan", "success");
    loadAssets();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Peminjaman Barang Inventaris</h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              HR mengisi form → unduh Word (Surat Penyerahan &amp; Pemegangan Barang) → ditandatangani pemegang barang, HRD, dan
              Direktur IT → HR mengunggah scan form. Selama scan belum diunggah, status tetap <b>Pending</b>.
            </p>
          </div>
          {!form && (
            <button type="button" className="btn-primary text-sm px-4 py-2" onClick={startCreate}>
              + Form peminjaman
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {(["", "PENDING", "ACTIVE", "RETURNED"] as const).map((key) => (
            <button
              key={key || "all"}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1 border ${
                statusFilter === key ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-200 text-slate-600"
              }`}
            >
              {key ? `${STATUS_STYLE[key].label.split(" —")[0]} (${counts[key]})` : `Semua (${loans.length})`}
            </button>
          ))}
          <input
            className="input-field text-xs py-1 ml-auto w-56"
            placeholder="Cari nomor, nama, barang, SN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {form && (
        <form onSubmit={submit} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingId ? "Ubah form peminjaman (pending)" : "Form peminjaman baru"}
            </h3>
            <button
              type="button"
              className="text-xs text-slate-500"
              onClick={() => {
                setForm(null);
                setEditingId(null);
              }}
            >
              Batal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600 space-y-1">
              <span>Nama pemegang barang</span>
              <select
                className="input-field"
                required
                disabled={!!editingId}
                value={form.borrowerId}
                onChange={(e) => chooseBorrower(e.target.value)}
              >
                <option value="">Pilih karyawan</option>
                {employees.map((employee) => (
                  <option key={employee.nik} value={employee.nik}>
                    {employee.name} · {employee.nik}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600 space-y-1">
              <span>Jabatan</span>
              <input className="input-field" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </label>
            <label className="text-xs text-slate-600 space-y-1">
              <span>Alamat rumah</span>
              <textarea
                className="input-field min-h-[60px]"
                value={form.homeAddress}
                onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600 space-y-1">
              <span>No. HP / Email</span>
              <input
                className="input-field"
                placeholder="08xx / nama@email.com"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">Nama barang dan spesifikasi</p>
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto] gap-2 items-start">
                <select className="input-field" required value={item.assetId} onChange={(e) => chooseAsset(index, e.target.value)}>
                  <option value="">Pilih barang</option>
                  {assets.map((asset) => {
                    const taken =
                      busyAssets.get(asset.id) ??
                      (form.items.some((other, i) => i !== index && other.assetId === asset.id) ? "sudah dipilih" : null);
                    return (
                      <option key={asset.id} value={asset.id} disabled={!!taken}>
                        {asset.laptop} · {asset.serialNumber}
                        {taken ? ` (${taken})` : asset.user ? ` — dipegang ${asset.user.name}` : ""}
                      </option>
                    );
                  })}
                </select>
                <textarea
                  className="input-field min-h-[40px]"
                  placeholder="Spesifikasi (otomatis dari data aset, bisa diubah)"
                  value={item.specification}
                  onChange={(e) => setItem(index, { specification: e.target.value })}
                />
                <button
                  type="button"
                  className="text-xs text-red-600 px-2 py-2 disabled:opacity-40"
                  disabled={form.items.length === 1}
                  onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}
                >
                  Hapus
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-medium text-orange-700"
              onClick={() => setForm({ ...form, items: [...form.items, { assetId: "", specification: "" }] })}
            >
              + Tambah barang
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600 space-y-1">
              <span>Penanggung jawab HRD (tanda tangan)</span>
              <input className="input-field" required value={form.hrName} onChange={(e) => setForm({ ...form, hrName: e.target.value })} />
            </label>
            <label className="text-xs text-slate-600 space-y-1">
              <span>Direktur IT MKTECH (tanda tangan)</span>
              <input
                className="input-field"
                value={form.directorName}
                onChange={(e) => setForm({ ...form, directorName: e.target.value })}
              />
            </label>
          </div>

          <button type="submit" disabled={busy} className="btn-primary text-sm px-4 py-2 disabled:opacity-60">
            {busy ? "Menyiapkan..." : editingId ? "Simpan & unduh Word" : "Buat & unduh Word"}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Nomor</th>
              <th className="px-4 py-2.5 text-left font-medium">Pemegang</th>
              <th className="px-4 py-2.5 text-left font-medium">Barang</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Belum ada form peminjaman
                </td>
              </tr>
            ) : (
              shown.map((loan) => (
                <tr key={loan.id} className="align-top">
                  <td className="px-4 py-3 border-t border-slate-100">
                    <div className="font-medium text-slate-900">{loan.number}</div>
                    <div className="text-xs text-slate-500">Dibuat {formatDate(loan.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 border-t border-slate-100">
                    <div className="font-medium text-slate-800">{loan.borrowerName}</div>
                    <div className="text-xs text-slate-500">{loan.jobTitle || "-"}</div>
                    {loan.contact && <div className="text-xs text-slate-500">{loan.contact}</div>}
                  </td>
                  <td className="px-4 py-3 border-t border-slate-100">
                    <ul className="space-y-0.5">
                      {loan.items.map((item) => (
                        <li key={item.id} className="text-xs text-slate-700">
                          <span className="font-medium">{item.assetName}</span> · {item.serialNumber}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 border-t border-slate-100">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[loan.status].className}`}>
                      {STATUS_STYLE[loan.status].label}
                    </span>
                    {loan.signedAt && (
                      <div className="text-xs text-slate-500 mt-1">
                        Form diunggah {formatDate(loan.signedAt)}
                        {loan.signedBy ? ` oleh ${loan.signedBy}` : ""}
                      </div>
                    )}
                    {loan.returnedAt && (
                      <div className="text-xs text-slate-500">Kembali {formatDate(loan.returnedAt)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 border-t border-slate-100">
                    <div className="flex flex-col items-start gap-1 text-xs">
                      <button
                        type="button"
                        className="font-medium text-slate-700"
                        onClick={() =>
                          downloadForm(loan).catch((err) =>
                            showToast(err instanceof Error ? err.message : "Gagal mengunduh form", "error")
                          )
                        }
                      >
                        Unduh Word
                      </button>
                      {loan.status !== "RETURNED" && (
                        <label className="font-medium text-orange-700 cursor-pointer">
                          {uploadFor === loan.id
                            ? "Mengunggah..."
                            : loan.status === "PENDING"
                              ? "Upload form bertanda tangan"
                              : "Ganti scan form"}
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadFor === loan.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (file) uploadSigned(loan, file);
                            }}
                          />
                        </label>
                      )}
                      {loan.signedPath && (
                        <a href={`/api/assets/loans/${loan.id}/signed`} target="_blank" rel="noreferrer" className="font-medium text-emerald-700">
                          Lihat form bertanda tangan
                        </a>
                      )}
                      {loan.status === "PENDING" && (
                        <>
                          <button type="button" className="text-slate-600" onClick={() => startEdit(loan)}>
                            Ubah
                          </button>
                          <button type="button" className="text-red-600" onClick={() => cancelLoan(loan)}>
                            Batalkan
                          </button>
                        </>
                      )}
                      {loan.status === "ACTIVE" && (
                        <button type="button" className="text-slate-600" onClick={() => returnLoan(loan)}>
                          Tandai dikembalikan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
