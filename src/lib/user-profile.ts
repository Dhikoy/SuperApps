/** Kolom profil karyawan untuk HR & Keuangan */
export const USER_PROFILE_SELECT = {
  birthDate: true,
  joinDate: true,
  bankAccount: true,
  homeAddress: true,
} as const;

export type UserProfileFields = {
  birthDate: string | null;
  joinDate: string | null;
  bankAccount: string | null;
  homeAddress: string | null;
};

export function serializeUserProfile(user: {
  birthDate?: Date | null;
  joinDate?: Date | null;
  bankAccount?: string | null;
  homeAddress?: string | null;
}): UserProfileFields {
  return {
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    joinDate: user.joinDate ? user.joinDate.toISOString().slice(0, 10) : null,
    bankAccount: user.bankAccount ?? null,
    homeAddress: user.homeAddress ?? null,
  };
}

export function formatDateId(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatJobTitle(jobTitle: string | null | undefined): string | null {
  if (!jobTitle?.trim()) return null;
  if (jobTitle.trim().toLowerCase() === "karyawan") return "Staff";
  return jobTitle;
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
