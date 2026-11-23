import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function StockOpnameLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasAnyPermission(session.role, ["finance:view", "stock:manage"])) {
    redirect("/dashboard");
  }
  return children;
}
