import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { JournalManager } from "@/components/accounting/JournalManager";

export default async function JurnalPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Jurnal Umum"
        subtitle="Jurnal otomatis dari transaksi + jurnal manual (saldo awal, penyusutan, koreksi)"
      />
      <JournalManager canManage={hasPermission(session.role, "finance:accounting")} />
    </div>
  );
}
