/** Zona waktu operasional BCI Group (WIB) */
export const APP_TIMEZONE = "Asia/Jakarta";

function jakartaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Jam lokal WIB "HH:MM" — untuk clock in/out */
export function getJakartaClockTime(now = new Date()): string {
  const { hour, minute } = jakartaDateParts(now);
  const h = hour === "24" ? "00" : hour;
  return `${h.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Tanggal hari ini 00:00 WIB (untuk query presensi) */
export function getJakartaTodayStart(now = new Date()): Date {
  const { year, month, day } = jakartaDateParts(now);
  return new Date(`${year}-${month}-${day}T00:00:00+07:00`);
}

/** Akhir hari 23:59:59 WIB */
export function getJakartaTodayEnd(now = new Date()): Date {
  const { year, month, day } = jakartaDateParts(now);
  return new Date(`${year}-${month}-${day}T23:59:59.999+07:00`);
}
