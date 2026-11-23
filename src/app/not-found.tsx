import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0c1222] to-slate-900 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold text-white">Halaman Tidak Ditemukan</h1>
        <p className="mt-2 text-slate-400">URL yang Anda akses tidak tersedia.</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
