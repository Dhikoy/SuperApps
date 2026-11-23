import { hasPermission, type Permission, type Role } from "@/lib/roles";
import { redirect } from "next/navigation";

export function requirePermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    redirect("/dashboard");
  }
}

export const INPUT_CLASS = "input-field";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    BELUM_MULAI: "bg-slate-100 text-slate-600 ring-slate-200",
    PROSES: "bg-amber-50 text-amber-700 ring-amber-200",
    ON_REVIEW: "bg-sky-50 text-sky-700 ring-sky-200",
    ON_PROSES: "bg-violet-50 text-violet-700 ring-violet-200",
    DONE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    SELESAI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    TELAT: "bg-red-50 text-red-700 ring-red-200",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
    ATASAN_APPROVED: "bg-sky-50 text-sky-700 ring-sky-200",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    REJECTED: "bg-red-50 text-red-700 ring-red-200",
    PAID: "bg-sky-50 text-sky-700 ring-sky-200",
    REALIZED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
    ISSUED: "bg-sky-50 text-sky-700 ring-sky-200",
    CANCELLED: "bg-red-50 text-red-700 ring-red-200",
    HADIR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    TERLAMBAT: "bg-orange-50 text-orange-700 ring-orange-200",
    IZIN: "bg-blue-50 text-blue-700 ring-blue-200",
    ALPHA: "bg-red-50 text-red-700 ring-red-200",
    BELUM_ABSEN: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  const labels: Record<string, string> = {
    BELUM_MULAI: "Belum mulai",
    PROSES: "Proses",
    ON_REVIEW: "Review",
    ON_PROSES: "On Proses",
    DONE: "Done",
    SELESAI: "Selesai",
    TELAT: "Telat",
    PENDING: "Menunggu Atasan",
    ATASAN_APPROVED: "Disetujui Atasan",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    PAID: "Sudah Dibayar",
    REALIZED: "Realisasi Selesai",
    DRAFT: "Draft",
    ISSUED: "Diterbitkan",
    CANCELLED: "Dibatalkan",
    HADIR: "Hadir",
    TERLAMBAT: "Terlambat",
    IZIN: "Izin",
    ALPHA: "Alpha",
    BELUM_ABSEN: "Belum Absen",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

const STAT_ACCENTS = {
  blue: { gradient: "from-blue-500 to-indigo-600", bar: "bg-blue-500" },
  orange: { gradient: "from-orange-500 to-amber-500", bar: "bg-orange-500" },
  green: { gradient: "from-emerald-500 to-teal-500", bar: "bg-emerald-500" },
  red: { gradient: "from-red-500 to-rose-500", bar: "bg-red-500" },
  purple: { gradient: "from-violet-500 to-purple-600", bar: "bg-violet-500" },
};

const STAT_ICONS: Record<string, string> = {
  blue: "👥",
  orange: "💻",
  green: "✓",
  red: "⏰",
  purple: "📋",
};

export function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number;
  accent: keyof typeof STAT_ACCENTS;
}) {
  const { gradient, bar } = STAT_ACCENTS[accent];
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`absolute top-0 left-0 w-full h-1 ${bar}`} />
      <div className="flex items-start justify-between pt-1">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white text-lg shadow-md`}
        >
          {STAT_ICONS[accent]}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1 text-sm lg:text-base">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {badge && (
          <span className="rounded-full bg-orange-50 px-4 py-1.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
            {badge}
          </span>
        )}
        {action}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`rounded-2xl bg-white border border-slate-200/80 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function AlertBanner({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success";
}) {
  const styles = {
    info: "bg-blue-50 border-blue-100 text-blue-900",
    warning: "bg-amber-50 border-amber-100 text-amber-900",
    success: "bg-emerald-50 border-emerald-100 text-emerald-900",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 text-sm leading-relaxed ${styles[variant]}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">{children}</div>
    </Card>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
        {children}
      </tr>
    </thead>
  );
}

export function TableCell({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <td data-label={label} className={`px-4 sm:px-6 py-4 text-sm text-slate-700 ${className}`}>
      {children}
    </td>
  );
}

export function HeroBanner({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8">
      <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-100/60 blur-2xl" />
      <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-blue-50 blur-2xl" />
      <div className="relative">
        {eyebrow && (
          <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-2">{eyebrow}</p>
        )}
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-2 text-sm lg:text-base">{subtitle}</p>}
      </div>
    </div>
  );
}
