import Link from "next/link";
import { getSession } from "@/lib/auth";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { FINANCE_GROUP_LABELS, FINANCE_MODULES, type FinanceModuleGroup } from "@/lib/finance-modules";
import { filterModulesForRole } from "@/lib/module-access";
import { hasPermission } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FINANCE_FLOW_LABEL } from "@/lib/finance-workflow";
import { formatRupiah } from "@/lib/payroll-policy";
import { profitLoss, todayJakarta } from "@/lib/accounting/reports";

export default async function KeuanganPage() {
  const session = await getSession();
  if (!session) return null;

  const role = session.role;
  const canFinance = hasPermission(role, "finance:view");
  const canApprove = hasPermission(role, "finance:approve");
  const canPay = hasPermission(role, "finance:pay");
  const canRealize = hasPermission(role, "finance:realize");

  const today = todayJakarta();
  const monthFilter = { from: `${today.slice(0, 8)}01`, to: today, company: null };

  const [pending, approved, paid, realized, pl] = await Promise.all([
    canFinance || canApprove ? prisma.fundRequest.count({ where: { status: "PENDING" } }) : 0,
    canPay ? prisma.fundRequest.count({ where: { status: "APPROVED" } }) : 0,
    canRealize ? prisma.fundRequest.count({ where: { status: "PAID" } }) : 0,
    canFinance ? prisma.fundRequest.count({ where: { status: "REALIZED" } }) : 0,
    canFinance ? profitLoss(monthFilter) : null,
  ]);

  const visibleModules = filterModulesForRole(role, FINANCE_MODULES);
  const groups = (Object.keys(FINANCE_GROUP_LABELS) as FinanceModuleGroup[])
    .map((g) => ({ group: g, items: visibleModules.filter((m) => m.group === g) }))
    .filter((g) => g.items.length > 0);

  const statCards = [
    (canFinance || canApprove) && { title: "Menunggu Approval", value: pending, accent: "orange" as const, tab: "approval" },
    canPay && { title: "Siap Dibayar", value: approved, accent: "blue" as const, tab: "pembayaran" },
    canRealize && { title: "Menunggu Realisasi", value: paid, accent: "purple" as const, tab: "realisasi" },
    canFinance && { title: "Selesai (Realized)", value: realized, accent: "green" as const, tab: "semua" },
  ].filter(Boolean) as { title: string; value: number; accent: "orange" | "blue" | "purple" | "green"; tab: string }[];

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Modul Keuangan"
        subtitle={canFinance ? FINANCE_FLOW_LABEL : "Akses payroll dan slip gaji"}
        badge={`${visibleModules.length} modul`}
      />

      {statCards.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${statCards.length >= 4 ? "lg:grid-cols-4" : ""}`}>
          {statCards.map((card) => (
            <Link key={card.title} href={`/dashboard/keuangan/pengajuan?tab=${card.tab}`}>
              <StatCard title={card.title} value={card.value} accent={card.accent} />
            </Link>
          ))}
        </div>
      )}

      {pl && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Laba Rugi bulan berjalan (semua perusahaan)</h2>
            <Link href="/dashboard/keuangan/laporan/laba-rugi" className="text-sm font-semibold text-[#503200] hover:underline">
              Lihat detail →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Pendapatan</p>
              <p className="text-lg font-bold text-emerald-600">
                {formatRupiah(pl.summary.pendapatanUsaha + pl.summary.pendapatanLuar)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Beban</p>
              <p className="text-lg font-bold text-red-600">
                {formatRupiah(pl.summary.hpp + pl.summary.bebanOperasional + pl.summary.bebanLain)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Laba (Rugi) Bersih</p>
              <p className={`text-lg font-bold ${pl.summary.labaBersih < 0 ? "text-red-600" : "text-slate-900"}`}>
                {formatRupiah(pl.summary.labaBersih)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada modul keuangan yang tersedia untuk role Anda.</p>
      ) : (
        groups.map(({ group, items }) => (
          <section key={group}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">{FINANCE_GROUP_LABELS[group]}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((mod) => (
                <Link
                  key={mod.slug}
                  href={mod.href}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-4 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <p className="font-semibold text-slate-900">{mod.label}</p>
                  <p className="text-sm text-slate-500 mt-1">{mod.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
