import Link from "next/link";
import { getSession } from "@/lib/auth";
import { canDeleteCompany, canManageCompanies } from "@/lib/roles";
import { redirect } from "next/navigation";
import { CompanyManager } from "@/components/CompanyManager";

export default async function PtPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageCompanies(session.role)) {
    redirect("/dashboard/hr");
  }

  const canDelete = canDeleteCompany(session.role);

  return (
    <div className="space-y-4 p-8">
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">
        ← Dashboard HR
      </Link>
      <CompanyManager canDelete={canDelete} />
    </div>
  );
}
