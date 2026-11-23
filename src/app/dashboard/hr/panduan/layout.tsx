import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";

export default async function PanduanHrLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, "hr:manage")) redirect("/dashboard");
  return children;
}
