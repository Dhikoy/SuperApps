export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DIREKSI"
  | "HRD"
  | "KEUANGAN"
  | "LEAD"
  | "STAFF"
  | "IT";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DIREKSI: "Direksi",
  HRD: "HRD",
  KEUANGAN: "Keuangan",
  LEAD: "Lead",
  STAFF: "Staff",
  IT: "IT MKTECH",
};

/** Role IT hanya untuk karyawan PT ini; semua non-Super Admin di PT ini otomatis IT. */
export const IT_ROLE_COMPANY = "MKTECH";

const SALARY_PERMISSIONS: Permission[] = ["payroll:view", "payroll:manage"];

export type Permission =
  | "dashboard:view"
  | "users:manage"
  | "users:view"
  | "assets:manage"
  | "assets:view"
  | "tasks:manage"
  | "tasks:view"
  | "tasks:own"
  | "leave:manage"
  | "leave:approve_atasan"
  | "leave:approve_hrd"
  | "leave:submit"
  | "leave:view"
  | "attendance:manage"
  | "attendance:view"
  | "attendance:clock"
  | "schedules:manage"
  | "schedules:view"
  | "payroll:view"
  | "payroll:manage"
  | "overtime:submit"
  | "finance:view"
  | "finance:submit"
  | "finance:approve"
  | "finance:pay"
  | "finance:realize"
  | "finance:accounting"
  | "hr:view"
  | "hr:manage"
  | "stock:manage"
  | "settings:manage"
  | "digital_assets:manage"
  /** Tambah & ubah master PT (tanpa hapus) */
  | "companies:manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "dashboard:view",
    "users:manage",
    "users:view",
    "assets:manage",
    "assets:view",
    "tasks:manage",
    "tasks:view",
    "leave:manage",
    "leave:submit",
    "leave:approve_atasan",
    "leave:approve_hrd",
    "leave:view",
    "attendance:manage",
    "attendance:view",
    "attendance:clock",
    "schedules:manage",
    "schedules:view",
    "payroll:view",
    "payroll:manage",
    "overtime:submit",
    "finance:view",
    "finance:submit",
    "finance:approve",
    "finance:pay",
    "finance:realize",
    "finance:accounting",
    "hr:view",
    "hr:manage",
    "stock:manage",
    "settings:manage",
    "digital_assets:manage",
  ],
  ADMIN: [
    "dashboard:view",
    "users:manage",
    "users:view",
    "assets:manage",
    "assets:view",
    "tasks:manage",
    "tasks:view",
    "leave:submit",
    "leave:view",
    "leave:approve_atasan",
    "attendance:view",
    "attendance:clock",
    "schedules:view",
    "payroll:view",
    "payroll:manage",
    "hr:view",
    "hr:manage",
    "stock:manage",
    "finance:view",
    "finance:submit",
    "finance:pay",
    "finance:realize",
    "finance:accounting",
  ],
  DIREKSI: [
    "dashboard:view",
    "users:view",
    "assets:view",
    "tasks:view",
    "leave:submit",
    "leave:approve_atasan",
    "leave:view",
    "attendance:view",
    "attendance:clock",
    "hr:view",
    "finance:approve",
    "finance:view",
  ],
  HRD: [
    "dashboard:view",
    "users:manage",
    "users:view",
    "assets:manage",
    "assets:view",
    "tasks:manage",
    "tasks:view",
    "leave:manage",
    "leave:submit",
    "leave:approve_hrd",
    "leave:view",
    "attendance:manage",
    "attendance:view",
    "attendance:clock",
    "schedules:manage",
    "schedules:view",
    "payroll:view",
    "payroll:manage",
    "overtime:submit",
    "hr:view",
    "hr:manage",
    "stock:manage",
  ],
  KEUANGAN: [
    "dashboard:view",
    "users:view",
    "assets:manage",
    "assets:view",
    "tasks:view",
    "leave:submit",
    "leave:view",
    "attendance:view",
    "attendance:clock",
    "payroll:view",
    "payroll:manage",
    "overtime:submit",
    "finance:view",
    "finance:submit",
    "finance:pay",
    "finance:realize",
    "finance:accounting",
    "digital_assets:manage",
    "hr:view",
    "companies:manage",
  ],
  LEAD: [
    "dashboard:view",
    "hr:view",
    "tasks:manage",
    "tasks:view",
    "tasks:own",
    "leave:submit",
    "leave:approve_atasan",
    "leave:view",
    "attendance:clock",
    "attendance:view",
  ],
  STAFF: [
    "dashboard:view",
    "assets:view",
    "tasks:own",
    "leave:submit",
    "leave:view",
    "attendance:clock",
    "overtime:submit",
    "schedules:view",
  ],
  IT: [],
};

ROLE_PERMISSIONS.IT = ROLE_PERMISSIONS.SUPER_ADMIN.filter((p) => !SALARY_PERMISSIONS.includes(p));

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Input/edit/hapus penalti, set rate, dan kunci periode. Hanya HRD dan Super Admin. */
export function canManagePenalty(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "HRD";
}

/** Buka kunci periode penalti. Hanya Super Admin. */
export function canUnlockPenalty(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canManageHrSettings(role: Role): boolean {
  return hasAnyPermission(role, ["settings:manage", "hr:manage"]);
}

export function canManageCompanies(role: Role): boolean {
  return hasAnyPermission(role, ["settings:manage", "hr:manage", "users:manage", "companies:manage"]);
}

export function canDeleteCompany(role: Role): boolean {
  return hasAnyPermission(role, ["settings:manage", "hr:manage"]);
}

const ASSET_VIEW_ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "DIREKSI", "HRD", "KEUANGAN", "IT"];

export function canViewAllAssets(role: Role): boolean {
  return ASSET_VIEW_ALL_ROLES.includes(role);
}

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "DIREKSI", "HRD", "KEUANGAN", "LEAD", "STAFF", "IT"];

export function isItCompany(company: string | null | undefined): boolean {
  return (company ?? "").trim().toUpperCase() === IT_ROLE_COMPANY;
}

/** Semua karyawan MKTECH default presensi fleksibel — kerja berpindah lokasi. */
export function defaultFlexibleAttendance(company: string | null | undefined): boolean {
  return isItCompany(company);
}

/** Terapkan aturan role per PT: MKTECH non-Super Admin selalu IT, PT lain tidak boleh IT. */
export function resolveRoleForCompany(
  role: Role,
  company: string | null | undefined
): { role: Role } | { error: string } {
  if (isItCompany(company)) return { role: role === "SUPER_ADMIN" ? role : "IT" };
  if (role === "IT") return { error: `Role ${ROLE_LABELS.IT} hanya untuk karyawan ${IT_ROLE_COMPANY}` };
  return { role };
}

/** Role yang bisa approve cuti semua karyawan (bukan hanya bawahan langsung) */
export const ATASAN_OVERRIDE_ROLES: Role[] = ["ADMIN", "DIREKSI", "SUPER_ADMIN"];

export function getAssignableRoles(actorRole: Role): Role[] {
  if (actorRole === "SUPER_ADMIN") return ALL_ROLES;
  return ALL_ROLES.filter((r) => r !== "SUPER_ADMIN");
}

export function canManageUser(actorRole: Role, targetRole: Role): boolean {
  if (!hasPermission(actorRole, "users:manage")) return false;
  if (targetRole === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") return false;
  // Cegah akses gaji tidak langsung (mis. reset password akun payroll lalu login sebagai dia).
  if (!hasPermission(actorRole, "payroll:view") && hasPermission(targetRole, "payroll:view")) return false;
  return true;
}

/** Edit profil karyawan (nama, tgl lahir, rekening, dll.) — hanya Super Admin & HRD */
export function canEditEmployeeProfile(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "HRD";
}

/** Ubah role karyawan — hanya Super Admin */
export function canAssignUserRole(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

/** Edit / hapus Catatan MOM — hanya Super Admin & Admin */
export function canManageMomNotes(role: Role | string): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function isSameUser(
  actorNik: string,
  actorUserId: string,
  targetNik: string,
  targetUserId: string
): boolean {
  return actorNik === targetNik || actorUserId === targetUserId;
}

export function canDeleteUser(
  actorRole: Role,
  actorNik: string,
  actorUserId: string,
  targetNik: string,
  targetUserId: string,
  targetRole: Role
): boolean {
  if (isSameUser(actorNik, actorUserId, targetNik, targetUserId)) return false;
  return canManageUser(actorRole, targetRole);
}

export function getDeleteUserBlockReason(
  actorRole: Role,
  actorNik: string,
  actorUserId: string,
  targetNik: string,
  targetUserId: string,
  targetRole: Role
): string | null {
  if (!hasPermission(actorRole, "users:manage")) {
    return "Hanya HR / Super Admin yang bisa menghapus karyawan";
  }
  if (isSameUser(actorNik, actorUserId, targetNik, targetUserId)) {
    return "Tidak bisa menghapus akun sendiri";
  }
  if (targetRole === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return "Hanya Super Admin yang bisa menghapus Super Admin";
  }
  if (!hasPermission(actorRole, "payroll:view") && hasPermission(targetRole, "payroll:view")) {
    return "Tidak bisa mengelola akun yang punya akses gaji";
  }
  return null;
}

export type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  icon: string;
  anyOf?: Permission[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/presensi/clock-in", label: "Clock In", permission: "attendance:clock", icon: "clock" },
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:view", icon: "grid" },
  { href: "/dashboard/hr", label: "Modul HR", permission: "hr:view", icon: "users" },
  {
    href: "/dashboard/keuangan",
    label: "Modul Keuangan",
    permission: "finance:view",
    anyOf: ["finance:view", "payroll:view"],
    icon: "report",
  },
  {
    href: "/dashboard/stock-opname",
    label: "Stock Opname",
    permission: "finance:view",
    anyOf: ["finance:view", "stock:manage"],
    icon: "laptop",
  },
  { href: "/dashboard/aset", label: "Aset", permission: "assets:view", icon: "laptop" },
  {
    href: "/dashboard/task",
    label: "Task",
    permission: "tasks:view",
    anyOf: ["tasks:view", "tasks:own"],
    icon: "check",
  },
  { href: "/dashboard/information", label: "Information", permission: "dashboard:view", icon: "report" },
  { href: "/dashboard/pengaturan", label: "Pengaturan", permission: "settings:manage", anyOf: ["settings:manage", "hr:manage"], icon: "settings" },
];

export function getNavForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.anyOf) return hasAnyPermission(role, item.anyOf);
    return hasPermission(role, item.permission);
  });
}

export { getPeriodRange, formatPeriodLabel, getPeriodShortLabel, MONTHS_ID } from "./period";
