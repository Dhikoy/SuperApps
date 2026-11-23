const USER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Normalisasi input username login (lowercase, huruf/angka/titik/garis) */
export function normalizeUserId(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, ".");
  const cleaned = raw.replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+/, "").replace(/[._-]+$/, "");
  if (!USER_ID_PATTERN.test(cleaned)) return null;
  return cleaned;
}

export function validateUserIdMessage(input: string): string | null {
  const normalized = normalizeUserId(input);
  if (!normalized) {
    return "User ID tidak valid — gunakan 3–30 karakter (huruf, angka, titik, garis bawah). Harus diawali huruf/angka.";
  }
  return null;
}

/** Saran username dari nama lengkap, mis. Muhammad Rijal → muhammad.rijal */
export function suggestUserIdFromName(name: string): string {
  const parts = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    const combined = normalizeUserId(`${parts[0]}.${parts[1]}`);
    if (combined) return combined;
  }

  const firstRaw = parts[0] || "user";
  const first = normalizeUserId(firstRaw) ?? firstRaw.slice(0, 30);
  return first || "user";
}
