import { getJakartaTodayStart } from "@/lib/timezone";

export function dateKeyJakarta(d = new Date()) {
  return getJakartaTodayStart(d).toISOString().slice(0, 10);
}
