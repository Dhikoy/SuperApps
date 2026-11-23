import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateNextNik } from "@/lib/nik";
import { resolveUserIdForCreate } from "@/lib/user-id-server";
import { parseOptionalDate, serializeUserProfile, USER_PROFILE_SELECT } from "@/lib/user-profile";
import {
  canManageUser,
  canAssignUserRole,
  defaultFlexibleAttendance,
  getAssignableRoles,
  hasPermission,
  resolveRoleForCompany,
  type Role,
} from "@/lib/roles";

const BASE_USER_SELECT = {
  nik: true,
  userId: true,
  name: true,
  role: true,
  company: true,
  jobTitle: true,
  createdAt: true,
  ...USER_PROFILE_SELECT,
} as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !hasPermission(session.role, "users:view") &&
    !hasPermission(session.role, "attendance:manage") &&
    !hasPermission(session.role, "tasks:manage")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const includeAll =
    hasPermission(session.role, "payroll:view") ||
    hasPermission(session.role, "attendance:manage");

  const users = await prisma.user.findMany({
    where: includeAll ? {} : { role: { not: "SUPER_ADMIN" } },
    select: BASE_USER_SELECT,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      ...serializeUserProfile(u),
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, password, role: requestedRole, company, jobTitle, birthDate, joinDate, bankAccount, homeAddress, userId } =
    await request.json();

  if (!name?.trim() || !password) {
    return NextResponse.json({ error: "Nama dan password wajib diisi" }, { status: 400 });
  }

  let role: Role = "STAFF";
  if (requestedRole && requestedRole !== "STAFF") {
    if (!canAssignUserRole(session.role)) {
      return NextResponse.json({ error: "Hanya Super Admin yang bisa menetapkan role selain Staff" }, { status: 403 });
    }
    const assignable = getAssignableRoles(session.role);
    if (!assignable.includes(requestedRole as Role)) {
      return NextResponse.json({ error: "Role tidak diizinkan" }, { status: 403 });
    }
    role = requestedRole as Role;
  }

  const pt = (company?.trim() || "BCI").toUpperCase();
  const resolvedRole = resolveRoleForCompany(role, pt);
  if ("error" in resolvedRole) {
    return NextResponse.json({ error: resolvedRole.error }, { status: 400 });
  }
  role = resolvedRole.role;
  const nik = await generateNextNik(pt);

  const userIdResult = await resolveUserIdForCreate(name.trim(), userId);
  if ("error" in userIdResult) {
    return NextResponse.json({ error: userIdResult.error }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      nik,
      userId: userIdResult.userId,
      name: name.trim(),
      password: await hashPassword(password),
      role,
      company: pt,
      flexibleAttendance: defaultFlexibleAttendance(pt),
      jobTitle: jobTitle?.trim() || "Staff",
      birthDate: parseOptionalDate(birthDate) ?? null,
      joinDate: parseOptionalDate(joinDate) ?? null,
      bankAccount: bankAccount?.trim() || null,
      homeAddress: homeAddress?.trim() || null,
    },
    select: BASE_USER_SELECT,
  });

  return NextResponse.json(
    { ...user, ...serializeUserProfile(user), createdAt: user.createdAt.toISOString() },
    { status: 201 }
  );
}
