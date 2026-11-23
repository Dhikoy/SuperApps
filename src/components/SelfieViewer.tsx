"use client";

import { useEffect, useState } from "react";

type SelfieViewerProps = {
  src: string;
  alt?: string;
  size?: "sm" | "md";
  label?: string;
};

export function SelfieViewer({ src, alt = "Foto selfie presensi", size = "md", label }: SelfieViewerProps) {
  const [open, setOpen] = useState(false);

  const thumbClass =
    size === "sm"
      ? "h-8 w-8 rounded-full object-cover ring-2 ring-brand/20"
      : "h-10 w-10 rounded-full object-cover ring-2 ring-brand/20";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand/40"
        title="Lihat foto selfie"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={`${thumbClass} cursor-zoom-in`} />
        {label && (
          <span className="text-xs font-medium text-brand group-hover:underline">{label}</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto selfie"
        >
          <div
            className="relative max-h-[90vh] max-w-lg animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100"
              aria-label="Tutup"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/20"
            />
            <p className="mt-3 text-center text-sm text-white/80">Klik di luar foto untuk menutup</p>
          </div>
        </div>
      )}
    </>
  );
}
