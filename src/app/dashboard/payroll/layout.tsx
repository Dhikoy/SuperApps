import { getSession } from "@/lib/auth";
import { requirePermission } from "@/components/ui";
import { redirect } from "next/navigation";

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "payroll:view");
  return children;
}
