import { prisma } from "@/lib/prisma";

export const DEFAULT_LEAVE_TYPES = [
  { name: "Cuti Tahunan", requiresAtasan: true, sortOrder: 1 },
  { name: "Cuti Melahirkan", requiresAtasan: true, sortOrder: 2 },
  { name: "Cuti Penting", requiresAtasan: true, sortOrder: 3 },
  { name: "Sakit", requiresAtasan: false, sortOrder: 4 },
  { name: "Izin Terlambat", requiresAtasan: false, sortOrder: 5 },
] as const;

/** Pastikan jenis cuti default ada di DB (tanpa mengubah yang sudah dinonaktifkan). */
export async function ensureDefaultLeaveTypes() {
  for (const lt of DEFAULT_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      create: { ...lt, isActive: true },
      update: {},
    });
  }
}

export async function getActiveLeaveTypes() {
  await ensureDefaultLeaveTypes();
  return prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, requiresAtasan: true, isActive: true, sortOrder: true },
  });
}

export async function isActiveLeaveType(name: string) {
  await ensureDefaultLeaveTypes();
  const row = await prisma.leaveType.findFirst({
    where: { name, isActive: true },
    select: { id: true },
  });
  return Boolean(row);
}
