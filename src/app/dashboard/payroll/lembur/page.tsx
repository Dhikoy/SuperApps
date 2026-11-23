import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { loadPolicyResolver } from "@/lib/payroll-data";
import { OvertimeManager } from "@/components/OvertimeManager";

export default async function LemburPage() {
  const session = await getSession();
  if (!session) return null;

  const canManage = hasPermission(session.role, "payroll:manage");
  let employees: { nik: string; name: string; company: string | null }[] = [];
  if (canManage) {
    const resolvePolicy = await loadPolicyResolver();
    const users = await prisma.user.findMany({
      where: { role: { not: "SUPER_ADMIN" } },
      select: { nik: true, name: true, company: true },
      orderBy: { name: "asc" },
    });
    employees = users.filter((u) => resolvePolicy(u.company)?.overtimeWeekday);
  }

  return <OvertimeManager canManage={canManage} employees={employees} />;
}
