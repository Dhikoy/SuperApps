"use client";

import { useState, useEffect, useRef } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const MODULES = [
  {
    icon: "📍",
    title: "Presensi",
    desc: "Clock-in selfie & GPS",
  },
  {
    icon: "🏖️",
    title: "Cuti",
    desc: "Pengajuan multi-level",
  },
  {
    icon: "📊",
    title: "Laporan HRD",
    desc: "Rekap & export PDF",
  },
  {
    icon: "💼",
    title: "Aset & Task",
    desc: "Inventaris & pekerjaan",
  },
];

const DEFAULT_PT_BADGES = ["BCI", "MKTECH", "MNT", "DPI", "LBB"];
const LAST_USER_ID_KEY = "superapps_last_user_id";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ptBadges, setPtBadges] = useState<string[]>(DEFAULT_PT_BADGES);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(LAST_USER_ID_KEY);
        if (saved) {
          setUserId((current) => current || saved);
          passwordRef.current?.focus();
        }
      } catch {
        /* localStorage tidak tersedia */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    async function verifyOrRedirect() {
      try {
        const res = await fetch(`/api/auth/session?_=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.ok) {
          window.location.replace("/dashboard");
        }
      } catch {
        /* tetap di login */
      }
    }

    void verifyOrRedirect();

    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPtBadges(data.map((c: { code: string }) => c.code));
        }
      })
      .catch(() => {});

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void verifyOrRedirect();
      }
    }

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "User ID atau password salah"
        );
        return;
      }

      try {
        localStorage.setItem(LAST_USER_ID_KEY, userId.trim());
      } catch {
        /* abaikan */
      }
      window.location.href = data.redirectTo ?? "/dashboard";
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi atau coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] login-mesh overflow-hidden">
      <div className="absolute inset-0 login-grid pointer-events-none" />
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#503200]/25 blur-3xl animate-login-glow pointer-events-none" />
      <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-[#f7c200]/10 blur-3xl animate-login-glow pointer-events-none [animation-delay:2s]" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] flex-col lg:flex-row">
        {/* Hero — desktop saja; di HP form login langsung tampil */}
        <section className="hidden lg:flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20 lg:py-16">
          <div className="mx-auto w-full max-w-xl lg:max-w-none animate-fade-in">
            <div className="mb-10 max-w-[360px]">
              <BrandLogo variant="hero" />
            </div>

            <h2 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl xl:text-[2.75rem]">
              Kelola seluruh
              <br />
              <span className="login-shimmer-text">operasional perusahaan</span>
              <br />
              dalam satu tempat.
            </h2>

            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400 sm:text-lg">
              Platform terintegrasi untuk presensi, cuti, karyawan, aset, dan task — dirancang untuk
              grup perusahaan multi-entity.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {ptBadges.map((pt) => (
                <span
                  key={pt}
                  className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300"
                >
                  {pt}
                </span>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:max-w-lg">
              {MODULES.map((mod, i) => (
                <div
                  key={mod.title}
                  className="login-feature-card rounded-2xl p-4 sm:p-5 animate-login-float"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <span className="text-2xl">{mod.icon}</span>
                  <p className="mt-2 text-sm font-bold text-white">{mod.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{mod.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Login */}
        <section className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10 lg:px-12 lg:py-16">
          <div className="w-full max-w-[420px] animate-fade-in">
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandLogo variant="sidebar" className="w-56" />
            </div>
            <div className="login-card rounded-3xl p-7 sm:p-9">
              <div className="mb-8 text-center lg:text-left">
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Selamat datang</h3>
                <p className="mt-1.5 text-sm text-slate-500">
                  Masuk dengan User ID (nama depan) Anda
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="userId" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    User ID
                  </label>
                  <input
                    id="userId"
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="input-field !py-3"
                    placeholder=""
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field !py-3 pr-12"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      ref={passwordRef}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full !py-3.5 text-base active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Memproses...
                    </span>
                  ) : (
                    "Masuk ke Dashboard"
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-slate-400">
                Butuh bantuan? Hubungi tim HRD atau IT perusahaan Anda.
              </p>
            </div>

            <p className="mt-6 text-center text-[11px] text-slate-500/80">
              © {new Date().getFullYear()} Brown Cinnamon Indonesia. All rights reserved.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
