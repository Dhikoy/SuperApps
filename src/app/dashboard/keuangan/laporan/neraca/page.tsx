import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { BalanceSheetView } from "@/components/accounting/StatementViews";

export default async function NeracaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Neraca" subtitle="Posisi aset, kewajiban, dan ekuitas per tanggal" />
      <BalanceSheetView />
    </div>
  );
}
