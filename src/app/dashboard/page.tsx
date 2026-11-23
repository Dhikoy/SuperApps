import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/roles";
import { PendingApprovalsPanel } from "@/components/PendingApprovalsPanel";
import { DailyAttendanceReport } from "@/components/DailyAttendanceReport";
import { StaffDashboard } from "@/components/StaffDashboard";

const PERSONAL_DASHBOARD_ROLES = new Set(["STAFF", "SUPER_ADMIN", "HRD", "LEAD", "IT"]);

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  if (PERSONAL_DASHBOARD_ROLES.has(session.role)) {
    return (
      <div className="space-y-6">
        <StaffDashboard session={session} />
        {hasAnyPermission(session.role, ["attendance:manage", "leave:approve_atasan", "leave:approve_hrd"]) && (
          <>
            <PendingApprovalsPanel />
            {hasPermission(session.role, "attendance:manage") && <DailyAttendanceReport />}
          </>
        )}
      </div>
    );
  }

  const userCount = await prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } });

  return (
    <div className="space-y-6">
      <StaffDashboard session={session} />
      <p className="text-sm text-slate-500 text-center">
        Total karyawan terdaftar: <strong>{userCount}</strong>
      </p>
    </div>
  );
}
