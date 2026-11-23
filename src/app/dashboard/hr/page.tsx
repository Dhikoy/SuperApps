import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { HR_MODULES } from "@/lib/hr-modules";
import { filterModulesForRole } from "@/lib/module-access";
import { hasAnyPermission, hasPermission, canManageHrSettings } from "@/lib/roles";
import { safePendingLeaveCount } from "@/lib/safe-db";

export default async function HrDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const role = session.role;
  const canManageHr = hasPermission(role, "hr:manage");
  const canViewUsers = hasPermission(role, "users:view");
  const canViewAttendance = hasAnyPermission(role, ["attendance:view", "attendance:manage"]);
  const canApproveLeave = hasAnyPermission(role, ["leave:approve_atasan", "leave:approve_hrd"]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [userCount, openRecruitment, activeContracts, pendingExit, todayAttendance, pendingLeave] =
    await Promise.all([
      canViewUsers ? prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }) : 0,
      canManageHr ? prisma.recruitment.count({ where: { status: { in: ["OPEN", "INTERVIEW", "OFFER"] } } }) : 0,
      canManageHr ? prisma.employmentContract.count({ where: { status: "ACTIVE" } }) : 0,
      canManageHr ? prisma.exitRequest.count({ where: { status: { in: ["PENDING", "APPROVED", "CLEARANCE"] } } }) : 0,
      canViewAttendance ? prisma.attendance.count({ where: { date: today } }) : 0,
      canApproveLeave ? safePendingLeaveCount() : Promise.resolve(0),
    ]);

  const canHrSettings = canManageHrSettings(role);

  const visibleModules = filterModulesForRole(role, HR_MODULES);

  const statCards = [
    canViewUsers && { title: "Total Karyawan", value: userCount, accent: "blue" as const },
    canViewAttendance && { title: "Hadir Hari Ini", value: todayAttendance, accent: "green" as const },
    canManageHr && { title: "Rekrutmen Aktif", value: openRecruitment, accent: "orange" as const },
    canManageHr && { title: "Exit Pending", value: pendingExit, accent: "red" as const },
  ].filter(Boolean) as { title: string; value: number; accent: "blue" | "green" | "orange" | "red" }[];

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Dashboard HR"
        subtitle="Pusat modul Human Resources BCI Group"
        badge={`${visibleModules.length} modul`}
      />

      {statCards.length > 0 && (
        <div className={`grid grid-cols-2 gap-4 ${statCards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
          {statCards.map((card) => (
            <StatCard key={card.title} title={card.title} value={card.value} accent={card.accent} />
          ))}
        </div>
      )}

      {canManageHr && (
        <Card className="p-5 text-sm text-slate-600">
          <p>
            Kontrak aktif: <strong className="text-slate-900">{activeContracts}</strong>
            {pendingLeave > 0 && (
              <>
                {" · "}
                Cuti menunggu approval: <strong className="text-amber-700">{pendingLeave}</strong>
              </>
            )}
          </p>
        </Card>
      )}

      {canApproveLeave && !canManageHr && pendingLeave > 0 && (
        <Card className="p-5 text-sm text-amber-700 bg-amber-50 border-amber-200">
          <p>
            <strong>{pendingLeave}</strong> pengajuan cuti menunggu persetujuan Anda
          </p>
        </Card>
      )}

      {canHrSettings && (
        <Link
          href="/dashboard/pengaturan"
          className="block rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 hover:bg-orange-100/80 transition-colors"
        >
          <p className="font-semibold text-orange-900">⚙️ Pengaturan Presensi & Cuti</p>
          <p className="text-sm text-orange-800/80 mt-1">
            Kelola jenis cuti/izin dan lokasi kantor (geofence 100m)
          </p>
        </Link>
      )}

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Modul HR</h2>
        {visibleModules.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada modul HR yang tersedia untuk role Anda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleModules.map((mod) => (
              <Link
                key={mod.slug}
                href={mod.href}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{mod.label}</p>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      mod.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : mod.status === "partial"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {mod.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{mod.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
