import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { BudgetManager } from "@/components/accounting/BudgetManager";

export default async function AnggaranPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Anggaran" subtitle="Target pendapatan & batas beban per akun per bulan" />
      <BudgetManager canEdit={hasPermission(session.role, "finance:accounting")} />
    </div>
  );
}
