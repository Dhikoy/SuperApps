import { prisma } from "@/lib/prisma";
import { companyLetterheadName } from "@/lib/invoice";

/** Nama KOP dari master PT (HR → Perusahaan), jatuh ke daftar bawaan bila PT belum terdaftar. */
export async function resolveLetterheadName(code: string): Promise<string> {
  const row = await prisma.company.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { name: true },
  });
  return row?.name?.trim() || companyLetterheadName(code);
}
