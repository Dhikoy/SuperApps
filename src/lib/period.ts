const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const APP_TIMEZONE = "Asia/Jakarta";

function jakartaYmd(date = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { year: y, month: m, day: d };
}

export function getCalendarMonthForDate(date = new Date()): { year: number; month: number } {
  const { year, month } = jakartaYmd(date);
  return { year, month };
}

/**
 * Periode cut-off yang berisi tanggal tertentu.
 * Contoh: 31 Agu 2026 → periode September 2026 (26 Agu – 25 Sep).
 */
export function getPeriodForDate(date = new Date()): { year: number; month: number } {
  const { year, month, day } = jakartaYmd(date);
  if (day >= 26) {
    if (month === 12) return { year: year + 1, month: 1 };
    return { year, month: month + 1 };
  }
  return { year, month };
}

/** Periode cut-off: tanggal 26 bulan sebelumnya s/d 25 bulan terpilih (WIB) */
export function getPeriodRange(year: number, month: number) {
  let startMonth = month - 1;
  let startYear = year;
  if (startMonth === 0) {
    startMonth = 12;
    startYear = year - 1;
  }
  const start = new Date(
    `${startYear}-${String(startMonth).padStart(2, "0")}-26T00:00:00+07:00`
  );
  const end = new Date(`${year}-${String(month).padStart(2, "0")}-25T23:59:59.999+07:00`);
  return { start, end };
}

/** Bulan kalender penuh: tanggal 1 s/d akhir bulan (WIB) */
export function getCalendarMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`);
  const end = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`
  );
  return { start, end };
}

export type PeriodMode = "cutoff" | "calendar";

export function resolvePeriodRange(year: number, month: number, mode: PeriodMode = "cutoff") {
  if (mode === "calendar") return getCalendarMonthRange(year, month);
  return getPeriodRange(year, month);
}

export function formatCalendarMonthLabel(year: number, month: number) {
  const { start, end } = getCalendarMonthRange(year, month);
  return `1 ${MONTHS_ID[month - 1]} ${year} — ${end.getDate()} ${MONTHS_ID[month - 1]} ${year}`;
}

export function formatPeriodLabelForMode(year: number, month: number, mode: PeriodMode) {
  if (mode === "calendar") return formatCalendarMonthLabel(year, month);
  return formatPeriodLabel(year, month);
}

export function formatPeriodLabel(year: number, month: number) {
  const { start, end } = getPeriodRange(year, month);
  const dayStart = start.getDate();
  const dayEnd = end.getDate();
  const monthStart = MONTHS_ID[start.getMonth()];
  const monthEnd = MONTHS_ID[end.getMonth()];
  return `${dayStart} ${monthStart} ${start.getFullYear()} — ${dayEnd} ${monthEnd} ${end.getFullYear()}`;
}

export function getPeriodShortLabel(year: number, month: number) {
  return `Periode ${MONTHS_ID[month - 1]} ${year}`;
}

export { MONTHS_ID };

/** @deprecated use getPeriodRange */
export function getMonthRange(year: number, month: number) {
  return getPeriodRange(year, month);
}
