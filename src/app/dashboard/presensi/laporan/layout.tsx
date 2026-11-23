import { getSession } from "@/lib/auth";
import { requirePermission } from "@/components/ui";
import { redirect } from "next/navigation";

export default async function LaporanLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "attendance:manage");
  return children;
}
