"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, type Role } from "@/lib/roles";
import { useNav } from "./NavContext";

type TabItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
  badge?: boolean;
};

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? "text-[#503200]" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? "text-[#503200]" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? "text-[#503200]" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? "text-[#503200]" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function MobileNav({ user }: { user: { role: Role } }) {
  const pathname = usePathname();
  const { toggleMenu } = useNav();

  const canClock = hasPermission(user.role, "attendance:clock");
  const [clockState, setClockState] = useState<"in" | "out" | "done" | null>(null);

  useEffect(() => {
    if (!canClock) return;
    let active = true;
    fetch("/api/attendance/today", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const today = data.today as { clockInTime: string | null; clockOutTime: string | null } | null;
        setClockState(!today?.clockInTime ? "in" : !today.clockOutTime ? "out" : "done");
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [canClock, pathname]);

  const presensiHref = canClock ? "/dashboard/presensi/clock-in" : "/dashboard/presensi";
  const presensiLabel = !canClock ? "Presensi" : clockState === "out" ? "Clock Out" : clockState === "done" ? "Presensi" : "Clock In";

  const tabs: TabItem[] = [
    {
      href: "/dashboard",
      label: "Beranda",
      icon: <HomeIcon active={pathname === "/dashboard"} />,
      match: (p) => p === "/dashboard",
    },
    {
      href: presensiHref,
      label: presensiLabel,
      icon: <ClockIcon active={pathname.startsWith("/dashboard/presensi")} />,
      match: (p) => p.startsWith("/dashboard/presensi"),
      badge: clockState === "in",
    },
    ...(hasPermission(user.role, "leave:view")
      ? [
          {
            href: "/dashboard/cuti",
            label: "Cuti",
            icon: <CalendarIcon active={pathname.startsWith("/dashboard/cuti")} />,
            match: (p: string) => p.startsWith("/dashboard/cuti"),
          } satisfies TabItem,
        ]
      : []),
    {
      href: "/dashboard/profil",
      label: "Profil",
      icon: <UserIcon active={pathname.startsWith("/dashboard/profil")} />,
      match: (p) => p.startsWith("/dashboard/profil"),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-stretch justify-around px-1 pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 px-1"
            >
              <span className={`relative p-1.5 rounded-xl transition-colors ${active ? "bg-[#503200]/10" : ""}`}>
                {tab.icon}
                {tab.badge && (
                  <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </span>
              <span className={`text-[10px] font-semibold ${active ? "text-[#503200]" : "text-slate-400"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={toggleMenu}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 px-1"
        >
          <span className="relative p-1.5 rounded-xl">
            <MenuIcon />
          </span>
          <span className="text-[10px] font-semibold text-slate-400">Menu</span>
        </button>
      </div>
    </nav>
  );
}
