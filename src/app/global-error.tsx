"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-[#0c1222] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold shadow-lg shadow-orange-500/30">
            BCI
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Terjadi Kesalahan</h1>
          <p className="text-slate-400 mb-8 text-sm leading-relaxed">
            Maaf, sistem mengalami gangguan. Silakan coba lagi atau kembali ke dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:opacity-90 transition-opacity"
            >
              Coba Lagi
            </button>
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Ke Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
