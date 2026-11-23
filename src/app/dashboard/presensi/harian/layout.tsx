import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManagePenalty, hasPermission } from "@/lib/roles";

export default async function HarianLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManagePenalty(session.role) && !hasPermission(session.role, "attendance:manage")) {
    redirect("/dashboard");
  }
  return children;
}
