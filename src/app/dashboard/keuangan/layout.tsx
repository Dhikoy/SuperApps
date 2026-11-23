import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/roles";
import { redirect } from "next/navigation";
import { FinanceNav } from "@/components/accounting/FinanceNav";

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasAnyPermission(session.role, ["finance:view", "payroll:view"])) {
    redirect("/dashboard");
  }
  return (
    <>
      <FinanceNav role={session.role} />
      {children}
    </>
  );
}
