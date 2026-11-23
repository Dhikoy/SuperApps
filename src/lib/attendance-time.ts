export const DEFAULT_CLOCK_IN = "09:00";
export const DEFAULT_CLOCK_OUT = "17:00";
export const LATE_TOLERANCE_MINUTES = 30;

/** Parse "HH:MM" ke total menit sejak tengah malam */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Format menit ke "HH:MM" */
export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Batas akhir masuk masih dianggap tepat waktu (masuk + toleransi) */
export function getOnTimeDeadline(clockIn: string, toleranceMinutes = LATE_TOLERANCE_MINUTES): string {
  return minutesToTime(timeToMinutes(clockIn) + toleranceMinutes);
}

/**
 * Terlambat jika clock in LEBIH dari batas toleransi.
 * Contoh: masuk 09:00, toleransi 30 menit → 09:00–09:30 hadir, 09:31 telat.
 */
export function isClockInLate(
  actualClockIn: string,
  standardClockIn = DEFAULT_CLOCK_IN,
  toleranceMinutes = LATE_TOLERANCE_MINUTES
): boolean {
  const deadline = timeToMinutes(getOnTimeDeadline(standardClockIn, toleranceMinutes));
  return timeToMinutes(actualClockIn) > deadline;
}

export function resolveAttendanceStatus(
  actualClockIn: string,
  standardClockIn = DEFAULT_CLOCK_IN
): "HADIR" | "TERLAMBAT" {
  return isClockInLate(actualClockIn, standardClockIn) ? "TERLAMBAT" : "HADIR";
}
