import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { PeriodCloseManager } from "@/components/accounting/PeriodCloseManager";

export default async function TutupBukuPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Tutup Buku" subtitle="Kunci periode yang sudah final agar laporan tidak berubah" />
      <PeriodCloseManager
        canClose={hasPermission(session.role, "finance:accounting")}
        canReopen={session.role === "SUPER_ADMIN" || session.role === "ADMIN"}
      />
    </div>
  );
}
