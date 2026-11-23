export type ShiftOption = {
  id: string;
  shiftName: string;
  standardClockIn: string;
  standardClockOut: string;
};

export function parseShiftOptionIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function serializeShiftOptionIds(ids: string[]): string | null {
  const unique = [...new Set(ids.filter(Boolean))];
  return unique.length > 0 ? JSON.stringify(unique) : null;
}

export function allowsShiftSelection(shiftOptionIds: string[]): boolean {
  return shiftOptionIds.length >= 2;
}

export function resolveShiftChoices(
  shiftOptionIds: string[],
  schedules: ShiftOption[],
  fallbackScheduleId: string | null
): ShiftOption[] {
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const fromOptions = shiftOptionIds.map((id) => byId.get(id)).filter((s): s is ShiftOption => !!s);

  if (fromOptions.length > 0) {
    return fromOptions.sort((a, b) => a.standardClockIn.localeCompare(b.standardClockIn));
  }

  if (fallbackScheduleId) {
    const fallback = byId.get(fallbackScheduleId);
    return fallback ? [fallback] : [];
  }

  return [];
}
