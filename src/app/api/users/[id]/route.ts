import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countOwnedRecords, deleteUserWithRelations, DeleteUserBlockedError } from "@/lib/delete-user";
import { resolveUserIdForUpdate } from "@/lib/user-id-server";
import { parseOptionalDate, serializeUserProfile, USER_PROFILE_SELECT } from "@/lib/user-profile";
import { canDeleteUser, canAssignUserRole, canEditEmployeeProfile, canManageUser, getAssignableRoles, hasPermission, resolveRoleForCompany, type Role } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";

type Params = { params: Promise<{ id: string }> };

const BASE_USER_SELECT = {
  nik: true,
  userId: true,
  name: true,
  role: true,
  company: true,
  jobTitle: true,
  createdAt: true,
  ...USER_PROFILE_SELECT,
  flexibleAttendance: true,
} as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: nik } = await params;
  const body = await request.json();

  const target = await prisma.user.findUnique({ where: { nik } });
  if (!target) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  if (!canManageUser(session.role, target.role as Role)) {
    return NextResponse.json({ error: "Tidak bisa mengubah karyawan ini" }, { status: 403 });
  }

  const isProfileUpdate =
    body.name !== undefined ||
    body.birthDate !== undefined ||
    body.joinDate !== undefined ||
    body.bankAccount !== undefined ||
    body.homeAddress !== undefined ||
    body.flexibleAttendance !== undefined ||
    body.userId !== undefined ||
    body.jobTitle !== undefined;

  if (isProfileUpdate && !canEditEmployeeProfile(session.role)) {
    return NextResponse.json({ error: "Hanya Super Admin dan HRD yang bisa mengubah profil" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    }
    data.name = name;
  }

  if (body.role !== undefined) {
    if (!canAssignUserRole(session.role)) {
      return NextResponse.json({ error: "Hanya Super Admin yang bisa mengubah role" }, { status: 403 });
    }
    const assignable = getAssignableRoles(session.role);
    if (!assignable.includes(body.role as Role)) {
      return NextResponse.json({ error: "Role tidak diizinkan" }, { status: 403 });
    }
    const resolvedRole = resolveRoleForCompany(body.role as Role, target.company);
    if ("error" in resolvedRole) {
      return NextResponse.json({ error: resolvedRole.error }, { status: 400 });
    }
    if (resolvedRole.role !== target.role) {
      await writeAuditLog({
        actorId: session.nik,
        actorName: session.name,
        action: "ROLE_CHANGE",
        entity: "User",
        entityId: nik,
        details: `${target.role} → ${resolvedRole.role} (@${target.userId})`,
      });
    }
    data.role = resolvedRole.role;
  }

  if (body.jobTitle !== undefined) {
    data.jobTitle = body.jobTitle?.trim() || null;
  }

  if (body.birthDate !== undefined) {
    data.birthDate = parseOptionalDate(body.birthDate);
  }
  if (body.joinDate !== undefined) {
    data.joinDate = parseOptionalDate(body.joinDate);
  }
  if (body.bankAccount !== undefined) {
    data.bankAccount = body.bankAccount?.trim() || null;
  }
  if (body.homeAddress !== undefined) {
    data.homeAddress = body.homeAddress?.trim() || null;
  }
  if (body.flexibleAttendance !== undefined) {
    data.flexibleAttendance = Boolean(body.flexibleAttendance);
  }

  if (body.userId !== undefined) {
    const resolved = await resolveUserIdForUpdate(String(body.userId), nik);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    data.userId = resolved.userId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada data untuk diupdate" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { nik },
    data,
    select: BASE_USER_SELECT,
  });

  return NextResponse.json({
    ...user,
    ...serializeUserProfile(user),
    createdAt: user.createdAt.toISOString(),
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: nik } = await params;

  const target = await prisma.user.findUnique({ where: { nik } });
  if (!target) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  if (
    !canDeleteUser(
      session.role,
      session.nik,
      session.userId,
      target.nik,
      target.userId,
      target.role as Role
    )
  ) {
    return NextResponse.json(
      {
        error:
          session.nik === target.nik || session.userId === target.userId
            ? "Tidak bisa menghapus akun sendiri"
            : target.role === "SUPER_ADMIN"
              ? "Hanya Super Admin yang bisa menghapus Super Admin"
              : "Tidak bisa menghapus karyawan ini",
      },
      { status: 403 }
    );
  }

  const transferTo = request.nextUrl.searchParams.get("transferTo")?.trim() || undefined;

  try {
    const owned = transferTo ? await countOwnedRecords(nik) : null;
    await deleteUserWithRelations(nik, { transferTo });
    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "USER_DELETE",
      entity: "User",
      entityId: nik,
      details: transferTo && owned
        ? `@${target.userId} dihapus; dokumen dialihkan ke ${transferTo} (${JSON.stringify(owned)})`
        : `@${target.userId} dihapus`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DeleteUserBlockedError) {
      return NextResponse.json(
        { error: err.message, code: err.code, owned: err.owned ?? null },
        { status: err.code === "TRANSFER_REQUIRED" ? 409 : 400 }
      );
    }
    console.error("[DELETE /api/users/:id]", nik, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Gagal menghapus karyawan — masih ada data terkait di database.",
        detail,
      },
      { status: 500 }
    );
  }
}
