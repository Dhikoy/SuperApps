"use client";

import { useEffect, useState } from "react";

const TZ = "Asia/Jakarta";

export function jakartaHHMM(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function LiveClock({ className = "", dateOnly = false }: { className?: string; dateOnly?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), dateOnly ? 60_000 : 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [dateOnly]);

  if (!now) return <span className={className}>{dateOnly ? "\u00a0" : "--:--"}</span>;
  return <span className={className}>{dateOnly ? formatDate(now) : jakartaHHMM(now)}</span>;
}
