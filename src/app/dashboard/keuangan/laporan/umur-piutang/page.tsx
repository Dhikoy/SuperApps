import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { AgingView } from "@/components/accounting/ExtraReportViews";

export default async function UmurPiutangPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Umur Piutang" subtitle="Invoice terbit yang belum dilunasi, dikelompokkan menurut lama keterlambatan" />
      <AgingView />
    </div>
  );
}
