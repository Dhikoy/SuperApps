import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { BudgetView } from "@/components/accounting/ExtraReportViews";

export default async function AnggaranRealisasiPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Anggaran vs Realisasi" subtitle="Perbandingan anggaran per akun dengan realisasi dari jurnal" />
      <BudgetView />
    </div>
  );
}
