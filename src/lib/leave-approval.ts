import { prisma } from "@/lib/prisma";
import { hasPermission, ATASAN_OVERRIDE_ROLES, type Role } from "@/lib/roles";

export async function canApproveAsAtasan(sessionId: string, sessionRole: Role, requestUserId: string) {
  if (!hasPermission(sessionRole, "leave:approve_atasan")) return false;

  const requester = await prisma.user.findUnique({
    where: { nik: requestUserId },
    select: { supervisorId: true },
  });
  if (!requester) return false;

  if (requester.supervisorId === sessionId) return true;
  if (ATASAN_OVERRIDE_ROLES.includes(sessionRole)) return true;
  return false;
}

export function canApproveAsHrd(role: Role) {
  return hasPermission(role, "leave:approve_hrd");
}
