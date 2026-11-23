import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { ProfitLossView } from "@/components/accounting/StatementViews";

export default async function LabaRugiPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Laporan Laba Rugi" subtitle="Pendapatan (4xx) dikurangi beban (5xx) dari jurnal" />
      <ProfitLossView />
    </div>
  );
}
