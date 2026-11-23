import { prisma } from "@/lib/prisma";

/** True jika menetapkan supervisorId akan membuat siklus hierarki. */
export async function wouldCreateSupervisorCycle(
  nik: string,
  supervisorId: string | null
): Promise<boolean> {
  if (!supervisorId) return false;
  if (supervisorId === nik) return true;

  let current: string | null = supervisorId;
  const visited = new Set<string>([nik]);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    const row: { supervisorId: string | null } | null = await prisma.user.findUnique({
      where: { nik: current },
      select: { supervisorId: true },
    });
    current = row?.supervisorId ?? null;
  }

  return false;
}
