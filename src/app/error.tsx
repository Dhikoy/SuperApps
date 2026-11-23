"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-lg w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-red-500/5">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
          ⚠
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Gagal Memuat Halaman</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Terjadi kendala saat mengambil data. Pastikan database sudah di-migrate, lalu coba lagi.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Muat Ulang
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
