"use client";

import { useCallback, useEffect, useState } from "react";

type LockState = {
  lockDate: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  checks: { key: string; label: string; ok: boolean; detail: string }[];
};

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function lastDay(year: number, month: number) {
  const d = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fmt(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** Bulan yang disarankan untuk ditutup: bulan setelah tanggal kunci, atau bulan lalu. */
function suggestedMonth(lockDate: string | null) {
  if (lockDate) {
    const [y, m] = lockDate.split("-").map(Number);
    return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
  }
  const now = new Date();
  return now.getMonth() === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: now.getMonth() };
}

export function PeriodCloseManager({ canClose, canReopen }: { canClose: boolean; canReopen: boolean }) {
  const [state, setState] = useState<LockState | null>(null);
  const [target, setTarget] = useState<{ year: number; month: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback((t: { year: number; month: number } | null) => {
    const params = t ? `?year=${t.year}&month=${t.month}` : "";
    return fetch(`/api/finance/accounting/lock${params}`)
      .then((r) => r.json())
      .then((d: LockState) => {
        setState(d);
        return d;
      });
  }, []);

  useEffect(() => {
    load(null).then((d) => {
      const t = suggestedMonth(d.lockDate);
      setTarget(t);
      load(t);
    });
  }, [load]);

  async function setLock(lockDate: string | null, confirmText: string) {
    if (!confirm(confirmText)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/finance/accounting/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockDate }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(typeof body.error === "string" ? body.error : "Gagal");
      return;
    }
    const d = await load(null);
    const t = suggestedMonth(d.lockDate);
    setTarget(t);
    load(t);
    setMsg(lockDate ? `Buku ditutup s/d ${fmt(lockDate)}` : "Tutup buku dibuka kembali");
  }

  const targetEnd = target ? lastDay(target.year, target.month) : null;
  const allOk = state?.checks.every((c) => c.ok) ?? false;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className={`rounded-2xl p-5 ${state?.lockDate ? "bg-slate-900 text-white" : "bg-amber-50 text-amber-900"}`}>
        <p className="text-xs uppercase tracking-wide opacity-70">Status tutup buku</p>
        <p className="mt-1 text-xl font-bold">
          {state ? (state.lockDate ? `Ditutup s/d ${fmt(state.lockDate)}` : "Belum pernah tutup buku") : "Memuat…"}
        </p>
        {state?.lockDate && (
          <p className="mt-1 text-sm opacity-80">
            Semua transaksi & jurnal bertanggal sampai {fmt(state.lockDate)} terkunci — tidak bisa ditambah, diubah, atau dihapus.
            {state.updatedBy ? ` Terakhir oleh ${state.updatedBy}.` : ""}
          </p>
        )}
      </div>

      {target && targetEnd && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Tutup buku bulan</h3>
              <p className="text-sm text-slate-500">Cek daftar di bawah sebelum mengunci.</p>
            </div>
            <input
              type="month"
              value={`${target.year}-${String(target.month).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (y && m) {
                  const t = { year: y, month: m };
                  setTarget(t);
                  load(t);
                }
              }}
              className="input-field ml-auto w-44"
            />
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {state?.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {c.ok ? "✓" : "!"}
                </span>
                <span className="flex-1">
                  <span className="font-medium text-slate-800">{c.label}</span>
                  <span className="block text-xs text-slate-500">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          {canClose && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setLock(
                    targetEnd,
                    `${allOk ? "" : "Masih ada catatan di daftar periksa. "}Tutup buku s/d ${fmt(targetEnd)}? Transaksi sampai tanggal itu tidak bisa diubah lagi.`
                  )
                }
                className="btn-primary"
              >
                Tutup buku s/d {fmt(targetEnd)}
              </button>
              {!allOk && <span className="text-xs text-amber-700">Boleh tetap ditutup, tapi sebaiknya selesaikan catatan di atas dulu.</span>}
            </div>
          )}
        </div>
      )}

      {canReopen && state?.lockDate && (
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5 space-y-2">
          <h3 className="font-semibold text-red-800">Buka kembali</h3>
          <p className="text-sm text-red-700">Hanya untuk koreksi. Laporan yang sudah diserahkan bisa berubah.</p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const [y, m] = state.lockDate.split("-").map(Number);
              const prev = m === 1 ? lastDay(y - 1, 12) : lastDay(y, m - 1);
              return (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setLock(prev, `Mundurkan tutup buku ke ${fmt(prev)}? Bulan ${MONTH_NAMES[m - 1]} ${y} bisa diubah lagi.`)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Buka {MONTH_NAMES[m - 1]} {y}
                </button>
              );
            })()}
            <button
              type="button"
              disabled={busy}
              onClick={() => setLock(null, "Hapus seluruh tutup buku? Semua periode bisa diubah lagi.")}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Buka semua
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-blue-700">{msg}</p>}
    </div>
  );
}
