"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { useNav } from "./NavContext";
import { BrandLogo } from "./BrandLogo";
import { LogoutButton } from "./LogoutButton";

function UserMenu({ user }: { user: { name: string; role: Role } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 lg:pr-3 hover:bg-[#fdf6e8] ring-1 ring-transparent hover:ring-[#e8dfd0] transition-all"
      >
        <span className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#503200]/25">
          {user.name.charAt(0)}
        </span>
        <span className="hidden lg:block text-left max-w-[180px]">
          <span className="block truncate text-sm font-semibold text-[#1a1208]">{user.name}</span>
          <span className="block truncate text-xs text-[#7a4f00]">{ROLE_LABELS[user.role]}</span>
        </span>
        <svg
          className={`hidden lg:block w-4 h-4 text-[#a08862] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-[#e8dfd0] animate-fade-in"
        >
          <div className="px-2 pb-3 border-b border-[#e8dfd0]">
            <p className="truncate text-sm font-semibold text-[#1a1208]">{user.name}</p>
            <p className="truncate text-xs text-[#7a4f00]">{ROLE_LABELS[user.role]}</p>
          </div>
          <Link
            href="/dashboard/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-[#4a3d2e] hover:bg-[#fdf6e8] hover:text-[#503200]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profil saya
          </Link>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}

export function TopBar({ user }: { user: { name: string; role: Role } }) {
  const { toggleMenu } = useNav();
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Selamat pagi" : now.getHours() < 17 ? "Selamat siang" : "Selamat malam";

  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e8dfd0] px-4 sm:px-6 lg:px-8 shadow-sm">
      <div className="flex h-14 sm:h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleMenu}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            aria-label="Buka menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="lg:hidden shrink-0 w-[100px]">
            <BrandLogo variant="compact" />
          </div>
          <div className="lg:hidden min-w-0 flex-1">
            <p className="font-bold text-[#503200] truncate text-sm leading-tight">{user.name}</p>
            <p className="text-[11px] text-[#7a4f00] truncate">{ROLE_LABELS[user.role]}</p>
          </div>

          <div className="hidden lg:block">
            <p className="text-xs text-slate-400 font-medium">{dateStr}</p>
            <p className="font-semibold text-slate-900">
              {greeting}, {user.name.split(" ")[0]} 👋
            </p>
          </div>
        </div>

        <UserMenu user={user} />

      </div>
    </header>
  );
}
