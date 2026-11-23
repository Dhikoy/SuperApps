import { prisma } from "@/lib/prisma";
import { generateUniqueUserId } from "@/lib/nik";
import { normalizeUserId, validateUserIdMessage } from "@/lib/user-id";

export async function resolveUserIdForCreate(
  name: string,
  requested?: string | null
): Promise<{ userId: string } | { error: string }> {
  const trimmed = requested?.trim();
  if (trimmed) {
    const validation = validateUserIdMessage(trimmed);
    if (validation) return { error: validation };
    const userId = normalizeUserId(trimmed)!;
    const existing = await prisma.user.findUnique({ where: { userId } });
    if (existing) return { error: `User ID "${userId}" sudah dipakai` };
    return { userId };
  }

  return { userId: await generateUniqueUserId(name.trim()) };
}

export async function resolveUserIdForUpdate(
  newInput: string,
  excludeNik: string
): Promise<{ userId: string } | { error: string }> {
  const validation = validateUserIdMessage(newInput);
  if (validation) return { error: validation };

  const userId = normalizeUserId(newInput)!;
  const existing = await prisma.user.findFirst({
    where: { userId, NOT: { nik: excludeNik } },
    select: { nik: true },
  });
  if (existing) return { error: `User ID "${userId}" sudah dipakai` };

  return { userId };
}
