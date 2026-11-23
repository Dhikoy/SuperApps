import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { DepreciationManager } from "@/components/accounting/DepreciationManager";

export default async function PenyusutanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Aset Tetap & Penyusutan" subtitle="Data perolehan aset dari modul inventaris, jurnal penyusutan otomatis tiap bulan" />
      <DepreciationManager canEdit={hasPermission(session.role, "finance:accounting")} />
    </div>
  );
}
