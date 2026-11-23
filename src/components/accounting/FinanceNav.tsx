"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FINANCE_GROUP_LABELS, FINANCE_MODULES, type FinanceModuleGroup } from "@/lib/finance-modules";
import { canAccessModule } from "@/lib/module-access";
import type { Role } from "@/lib/roles";

export function FinanceNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = FINANCE_MODULES.filter((m) => canAccessModule(role, m));
  const groups = (Object.keys(FINANCE_GROUP_LABELS) as FinanceModuleGroup[])
    .map((g) => ({ group: g, items: visible.filter((m) => m.group === g) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === "/dashboard/keuangan" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="border-b border-slate-200 bg-white/80 px-4 lg:px-8 print:hidden" aria-label="Menu keuangan">
      <div className="flex gap-6 overflow-x-auto overscroll-x-contain py-2">
        {groups.map(({ group, items }) => (
          <div key={group} className="flex shrink-0 items-center gap-1">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {FINANCE_GROUP_LABELS[group]}
            </span>
            {items.map((m) => (
              <Link
                key={m.slug}
                href={m.href}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  isActive(m.href) ? "bg-[#503200] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {m.slug === "dashboard" ? "Dashboard" : m.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
