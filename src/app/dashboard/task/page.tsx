import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { TaskPanel } from "@/components/TaskPanel";

export default async function TaskPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage = hasPermission(session.role, "tasks:manage");
  const canViewAll = hasPermission(session.role, "tasks:view");
  const canOwn = hasPermission(session.role, "tasks:own");

  if (!canManage && !canViewAll && !canOwn) {
    redirect("/dashboard");
  }

  return <TaskPanel canManage={canManage} canViewAll={canViewAll || canManage} userNik={session.nik} />;
}
