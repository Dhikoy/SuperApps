import Link from "next/link";
import { redirect } from "next/navigation";
import type { FundRequestStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { hasPermission, type Permission } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getFinanceStageLabel, FINANCE_FLOW_LABEL } from "@/lib/finance-workflow";
import { formatRupiah } from "@/lib/payroll-policy";
import { FundRequestActions } from "./FundRequestActions";
import { FinanceActions } from "../FinanceActions";

type TabKey = "semua" | "approval" | "pembayaran" | "realisasi";

const TABS: { key: TabKey; label: string; status?: FundRequestStatus; permission?: Permission }[] = [
  { key: "semua", label: "Semua" },
  { key: "approval", label: "Approval", status: "PENDING", permission: "finance:approve" },
  { key: "pembayaran", label: "Pembayaran", status: "APPROVED", permission: "finance:pay" },
  { key: "realisasi", label: "Realisasi", status: "PAID", permission: "finance:realize" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PengajuanPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const role = session.role;

  const tabs = TABS.filter((t) => !t.permission || hasPermission(role, t.permission));
  const requested = (await searchParams).tab;
  const active = tabs.find((t) => t.key === requested) ?? tabs[0];

  const canSeeAll =
    hasPermission(role, "finance:approve") || hasPermission(role, "finance:pay") || hasPermission(role, "finance:realize");

  const [requests, counts, accounts] = await Promise.all([
    prisma.fundRequest.findMany({
      where: {
        ...(active.status ? { status: active.status } : {}),
        ...(!canSeeAll ? { submittedBy: session.id } : {}),
      },
      include: { submitter: { select: { name: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: active.status ? 200 : 50,
    }),
    prisma.fundRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.account.findMany({ select: { code: true, name: true } }),
  ]);
  const countFor = (status?: FundRequestStatus) =>
    status ? (counts.find((c) => c.status === status)?._count._all ?? 0) : null;
  const accountName = new Map(accounts.map((a) => [a.code, a.name]));

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Pengajuan Dana"
        subtitle={FINANCE_FLOW_LABEL}
        action={
          hasPermission(role, "finance:submit") ? (
            <Link href="/dashboard/keuangan/pengajuan/baru" className="btn-primary">
              + Buat Pengajuan
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((t) => {
          const count = countFor(t.status);
          return (
            <Link
              key={t.key}
              href={`/dashboard/keuangan/pengajuan?tab=${t.key}`}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                t.key === active.key ? "border-[#503200] text-[#503200]" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {count ? <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{count}</span> : null}
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          {active.key === "semua" ? "Belum ada pengajuan dana" : "Tidak ada pengajuan di tahap ini"}
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const realized = req.realizedAmount ?? req.totalAmount;
            return (
              <Card key={req.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{req.title}</h3>
                    <p className="text-sm text-slate-500">
                      {req.company} · {req.submitter.name} · {formatRupiah(req.totalAmount)}
                      {req.status === "REALIZED" && req.realizedAmount !== null && ` · aktual ${formatRupiah(realized)}`}
                    </p>
                    {req.paymentRef && <p className="text-xs text-slate-400">Ref bayar: {req.paymentRef}</p>}
                    {req.paidFromAccount && (
                      <p className="text-xs text-slate-400">
                        Dibayar dari {req.paidFromAccount} {accountName.get(req.paidFromAccount) ?? ""}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{getFinanceStageLabel(req.status)}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
                <ul className="mt-3 text-sm text-slate-600 space-y-1">
                  {req.items.map((item) => (
                    <li key={item.id}>
                      • {item.itemName} — {item.quantity} {item.unit} × {formatRupiah(item.unitPrice)} = {formatRupiah(item.subtotal)}
                      {item.accountCode && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                          {item.accountCode} {accountName.get(item.accountCode) ?? ""}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {active.key === "semua" && (
                  <FundRequestActions id={req.id} status={req.status} canEdit={hasPermission(role, "finance:submit")} />
                )}
                {active.key === "approval" && (
                  <FinanceActions requestId={req.id} action="approve" stageLabel={getFinanceStageLabel(req.status)} />
                )}
                {active.key === "pembayaran" && (
                  <FinanceActions requestId={req.id} action="pay" stageLabel={getFinanceStageLabel(req.status)} showPaymentRef />
                )}
                {active.key === "realisasi" && (
                  <FinanceActions
                    requestId={req.id}
                    action="realize"
                    stageLabel={getFinanceStageLabel(req.status)}
                    showRealizationNote
                    totalAmount={req.totalAmount}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
