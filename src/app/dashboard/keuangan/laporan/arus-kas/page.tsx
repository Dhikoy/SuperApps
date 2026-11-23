import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { CashFlowView } from "@/components/accounting/ExtraReportViews";

export default async function ArusKasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Laporan Arus Kas" subtitle="Penerimaan & pengeluaran kas/bank dari jurnal (metode langsung)" />
      <CashFlowView />
    </div>
  );
}
