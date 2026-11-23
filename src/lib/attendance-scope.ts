import type { Prisma } from "@/generated/prisma/client";

/** Semua akun termasuk Super Admin — ikut laporan & sync presensi */
export function attendanceScopeUserWhere(): Prisma.UserWhereInput {
  return {};
}
