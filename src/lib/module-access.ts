import { hasAnyPermission, hasPermission, type Permission, type Role } from "@/lib/roles";

export type ModuleAccess = {
  permission: Permission;
  anyOf?: Permission[];
};

export function canAccessModule(role: Role, mod: ModuleAccess): boolean {
  if (mod.anyOf) return hasAnyPermission(role, mod.anyOf);
  return hasPermission(role, mod.permission);
}

export function filterModulesForRole<T extends ModuleAccess>(role: Role, modules: T[], excludeSlugs: string[] = ["dashboard"]): T[] {
  return modules.filter((m) => {
    const slug = (m as T & { slug?: string }).slug;
    if (slug && excludeSlugs.includes(slug)) return false;
    return canAccessModule(role, m);
  });
}
