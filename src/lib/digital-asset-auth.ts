import { getSession } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/roles";
import { NextResponse } from "next/server";

/** Kelola aset digital: Super Admin & Admin Keuangan saja. */
export function canManageDigitalAssets(role: Role): boolean {
  return hasPermission(role, "digital_assets:manage");
}

export async function requireDigitalAssetApi() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageDigitalAssets(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
