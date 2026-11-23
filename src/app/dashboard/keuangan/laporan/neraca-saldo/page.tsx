import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { TrialBalanceView } from "@/components/accounting/TrialBalanceView";

export default async function NeracaSaldoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Neraca Saldo" subtitle="Total mutasi debit & kredit per akun — klik nama akun untuk buku besar" />
      <TrialBalanceView />
    </div>
  );
}
