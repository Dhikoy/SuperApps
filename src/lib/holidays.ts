/** Libur nasional Indonesia — untuk perhitungan lembur BCI (2×) */
export const NATIONAL_HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: "2026-01-01", name: "Tahun Baru" },
  { date: "2026-01-16", name: "Isra Mikraj" },
  { date: "2026-03-19", name: "Hari Suci Nyepi" },
  { date: "2026-03-20", name: "Idul Fitri" },
  { date: "2026-03-21", name: "Idul Fitri" },
  { date: "2026-04-03", name: "Wafat Isa Almasih" },
  { date: "2026-05-01", name: "Hari Buruh Internasional" },
  { date: "2026-05-14", name: "Kenaikan Isa Almasih" },
  { date: "2026-05-27", name: "Idul Adha" },
  { date: "2026-06-01", name: "Hari Lahir Pancasila" },
  { date: "2026-06-26", name: "Tahun Baru Islam" },
  { date: "2026-08-17", name: "Hari Kemerdekaan RI" },
  { date: "2026-12-25", name: "Hari Natal" },
];

/** Libur nasional Indonesia 2027 — sesuaikan jika SK resmi berubah */
export const NATIONAL_HOLIDAYS_2027: { date: string; name: string }[] = [
  { date: "2027-01-01", name: "Tahun Baru" },
  { date: "2027-01-06", name: "Isra Mikraj" },
  { date: "2027-03-09", name: "Hari Suci Nyepi" },
  { date: "2027-03-10", name: "Idul Fitri" },
  { date: "2027-03-11", name: "Idul Fitri" },
  { date: "2027-03-26", name: "Wafat Isa Almasih" },
  { date: "2027-05-01", name: "Hari Buruh Internasional" },
  { date: "2027-05-06", name: "Kenaikan Isa Almasih" },
  { date: "2027-05-17", name: "Idul Adha" },
  { date: "2027-06-01", name: "Hari Lahir Pancasila" },
  { date: "2027-06-16", name: "Tahun Baru Islam" },
  { date: "2027-08-17", name: "Hari Kemerdekaan RI" },
  { date: "2027-12-25", name: "Hari Natal" },
];

export const ALL_NATIONAL_HOLIDAYS = [...NATIONAL_HOLIDAYS_2026, ...NATIONAL_HOLIDAYS_2027];

export function isNationalHoliday(date: Date, holidayDates: Set<string>): boolean {
  const key = date.toISOString().slice(0, 10);
  return holidayDates.has(key);
}

export function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
