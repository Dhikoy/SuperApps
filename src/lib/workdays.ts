import { getJakartaTodayStart } from "@/lib/timezone";
import { toDateKey } from "@/lib/holidays";

/** Iterate each calendar day (WIB midnight) from start through end inclusive */
export function iterateJakartaDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let current = getJakartaTodayStart(start);
  const last = getJakartaTodayStart(end);

  while (current.getTime() <= last.getTime()) {
    dates.push(new Date(current));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return dates;
}

export function jakartaWeekday(date: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? 0;
}

export function isWorkDay(
  date: Date,
  pattern: "MON_FRI" | "MON_SUN",
  holidayDates: Set<string>
): boolean {
  const key = toDateKey(date);
  if (holidayDates.has(key)) return false;
  if (pattern === "MON_SUN") return true;
  const wd = jakartaWeekday(date);
  return wd >= 1 && wd <= 5;
}
