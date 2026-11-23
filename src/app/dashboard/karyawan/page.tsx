import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission, PageHeader, AlertBanner } from "@/components/ui";
import { KaryawanManager } from "@/components/KaryawanManager";
import { getAssignableRoles, hasAnyPermission, hasPermission, canEditEmployeeProfile, type Role } from "@/lib/roles";
import { serializeUserProfile, USER_PROFILE_SELECT } from "@/lib/user-profile";

export default async function KaryawanPage() {
  const session = await getSession();
  if (!session) return null;
  requirePermission(session.role, "users:view");

  const canManage = hasPermission(session.role, "users:manage");
  const canEditProfile = canEditEmployeeProfile(session.role);
  const canViewProfile = hasAnyPermission(session.role, ["hr:view", "hr:manage", "payroll:view", "finance:view"]);
  const assignableRoles = getAssignableRoles(session.role);

  type KaryawanRow = {
    nik: string;
    userId: string;
    name: string;
    role: string;
    company: string | null;
    jobTitle: string | null;
    createdAt: Date;
    birthDate: Date | null;
    joinDate: Date | null;
    bankAccount: string | null;
    homeAddress: string | null;
    flexibleAttendance: boolean;
  };
  let users: KaryawanRow[] = [];
  let dbError = false;

  try {
    users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        nik: true,
        userId: true,
        name: true,
        role: true,
        company: true,
        jobTitle: true,
        flexibleAttendance: true,
        createdAt: true,
        ...USER_PROFILE_SELECT,
      },
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Karyawan"
        subtitle={
          canEditProfile
            ? "Kelola profil karyawan (nama, tgl lahir, rekening, alamat) dan role"
            : canManage
              ? "Kelola karyawan dan role"
              : canViewProfile
                ? "Data karyawan termasuk profil untuk keperluan HR & keuangan"
                : "Daftar seluruh karyawan perusahaan"
        }
        badge={dbError ? undefined : `${users.length} karyawan`}
      />

      {dbError && (
        <AlertBanner variant="warning">
          Database belum sinkron dengan schema NIK. Jalankan:{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">npx prisma db push</code> lalu{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">npm run db:seed</code>
        </AlertBanner>
      )}

      {!dbError && (
        <KaryawanManager
          users={users.map((u) => ({
            ...u,
            role: u.role as Role,
            createdAt: u.createdAt.toISOString(),
            ...serializeUserProfile(u),
          }))}
          assignableRoles={assignableRoles}
          canManage={canManage}
          canEditProfile={canEditProfile}
          canViewProfile={canViewProfile}
          actorRole={session.role}
          actorNik={session.nik}
          actorUserId={session.userId}
        />
      )}
    </div>
  );
}
