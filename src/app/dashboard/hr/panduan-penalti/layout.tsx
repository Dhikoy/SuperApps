import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManagePenalty } from "@/lib/roles";

export default async function PanduanPenaltiLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManagePenalty(session.role)) redirect("/dashboard");
  return children;
}
