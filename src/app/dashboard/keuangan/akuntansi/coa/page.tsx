import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { CoaManager } from "@/components/accounting/CoaManager";

export default async function CoaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Master COA"
        subtitle="Chart of Accounts — akun induk hanya untuk pengelompokan, jurnal memakai akun detail"
      />
      <CoaManager canManage={hasPermission(session.role, "finance:accounting")} />
    </div>
  );
}
