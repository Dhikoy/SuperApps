"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getNavForRole, type Role, type NavItem } from "@/lib/roles";
import { useNav } from "./NavContext";
import { BrandLogo } from "./BrandLogo";

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const cls = active ? "text-white" : "text-[#7a4f00] group-hover:text-[#503200]";
  const icons: Record<string, ReactNode> = {
    grid: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    users: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    laptop: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    check: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    calendar: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    plus: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
    shield: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    clock: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    schedule: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    settings: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    report: (
      <svg className={`w-[18px] h-[18px] ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  };
  return <>{icons[icon] ?? <span className={cls}>•</span>}</>;
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-[#503200] text-white shadow-md shadow-[#503200]/20"
          : "text-[#4a3d2e] hover:bg-[#fdf6e8] hover:text-[#503200]"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
          active
            ? "bg-[#f7c200]/20 ring-1 ring-[#f7c200]/40"
            : "bg-[#fdf6e8] ring-1 ring-[#e8dfd0] group-hover:ring-[#f7c200]/50"
        }`}
      >
        <NavIcon icon={item.icon} active={active} />
      </span>
      {item.label}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#f7c200]" />}
    </Link>
  );
}

function SidebarContent({
  user,
  onNavigate,
}: {
  user: { name: string; role: Role };
  onNavigate?: () => void;
}) {
  const navItems = getNavForRole(user.role);

  return (
    <>
      <div className="sidebar-brand-header">
        <BrandLogo variant="sidebar" href="/dashboard" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-[#a08862]">Menu</p>
        {navItems.map((item) => (
          <NavLink key={`${item.href}-${item.label}`} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    </>
  );
}

export function Sidebar({ user }: { user: { name: string; role: Role } }) {
  const { menuOpen, setMenuOpen } = useNav();
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col sidebar-light min-h-screen">
        <SidebarContent user={user} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(280px,88vw)] flex flex-col sidebar-light shadow-2xl animate-fade-in">
            <SidebarContent user={user} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
