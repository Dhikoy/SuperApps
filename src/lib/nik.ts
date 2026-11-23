import { prisma } from "@/lib/prisma";

/** Kode PT → 2 digit prefix NIK */
export const COMPANY_NIK_PREFIX: Record<string, string> = {
  BCI: "01",
  MKTECH: "02",
  MNT: "03",
  DPI: "04",
  LBB: "05",
  PIC: "06",
};

const NIK_YEAR = "2026";

/** Bangun NIK 16 digit: [prefix PT 2][tahun 4][urutan 8] */
export function buildNik(company: string, sequence: number): string {
  const prefix = COMPANY_NIK_PREFIX[company.toUpperCase()] ?? "99";
  return `${prefix}${NIK_YEAR}${String(sequence).padStart(8, "0")}`;
}

/** Urutan berikutnya per perusahaan (untuk seed / tambah karyawan) */
export function nextSequenceForCompany(existingNiks: string[], company: string): number {
  const prefix = COMPANY_NIK_PREFIX[company.toUpperCase()] ?? "99";
  const pattern = `${prefix}${NIK_YEAR}`;
  let max = 0;
  for (const nik of existingNiks) {
    if (nik.startsWith(pattern)) {
      const seq = parseInt(nik.slice(pattern.length), 10);
      if (!Number.isNaN(seq) && seq > max) max = seq;
    }
  }
  return max + 1;
}

/** Generate NIK baru dari database */
export async function generateNextNik(company = "BCI"): Promise<string> {
  const users = await prisma.user.findMany({ select: { nik: true } });
  const seq = nextSequenceForCompany(
    users.map((u) => u.nik),
    company
  );
  return buildNik(company, seq);
}

/** Nama depan dari nama lengkap → userId login (lowercase) */
export function firstNameFromFullName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** userId unik untuk seed (duplikat nama depan → rifky2, rifky3, …) */
export function uniqueUserIdFromName(name: string, used: Set<string>): string {
  const base = firstNameFromFullName(name) || "user";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}${n}`)) n++;
  const id = `${base}${n}`;
  used.add(id);
  return id;
}

/** userId unik dari database */
export async function generateUniqueUserId(name: string): Promise<string> {
  const base = firstNameFromFullName(name) || "user";
  let candidate = base;
  let n = 2;
  while (await prisma.user.findUnique({ where: { userId: candidate } })) {
    candidate = `${base}${n}`;
    n++;
  }
  return candidate;
}

/** @deprecated Email tidak dipakai lagi untuk login */
export function emailFromName(name: string, company: string, suffix = ""): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, "")
    .trim()
    .split(/\s+/)[0]
    .slice(0, 24);
  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${base}${suffix}@${domain}.bci.id`;
}
