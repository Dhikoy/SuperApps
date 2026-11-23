import { getSession } from "@/lib/auth";
import { hasAnyPermission, hasPermission, type Permission } from "@/lib/roles";
import { NextResponse } from "next/server";

export async function requireHrApi(permission: Permission | Permission[] = "hr:view") {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const ok = Array.isArray(permission)
    ? hasAnyPermission(session.role, permission)
    : hasPermission(session.role, permission);

  if (!ok) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

/** API data sensitif HR (rekrutmen, kontrak, BPJS, PPh21, dll) — hanya HRD/Admin. */
export async function requireHrSensitiveApi() {
  return requireHrApi("hr:manage");
}

export function canManageStock(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, "stock:manage") || hasPermission(role, "finance:submit");
}

export function canViewStock(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, "stock:manage") || hasPermission(role, "finance:view");
}
