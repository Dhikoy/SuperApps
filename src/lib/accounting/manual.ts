import type { JournalSource } from "@/generated/prisma/client";

/** Header jurnal umum dari body request: tanggal (YYYY-MM-DD), perusahaan, keterangan, tipe. */
export function parseManualHeader(body: Record<string, unknown>) {
  const date = String(body.date ?? "");
  const company = String(body.company ?? "").trim().toUpperCase();
  const description = String(body.description ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tanggal jurnal wajib diisi" } as const;
  if (!company) return { error: "Perusahaan wajib dipilih" } as const;
  if (!description) return { error: "Keterangan jurnal wajib diisi" } as const;
  return {
    date: new Date(`${date}T12:00:00+07:00`),
    company,
    description,
    source: (body.source === "OPENING" ? "OPENING" : "MANUAL") as JournalSource,
  };
}
