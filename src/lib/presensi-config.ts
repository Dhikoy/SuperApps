import type { GeoPoint } from "@/lib/geo";
import type { ShiftOption } from "@/lib/shift-options";

export type UserPresensiConfig = {
  officeLocationId: string | null;
  workScheduleId: string | null;
  office: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  schedule: {
    id: string;
    shiftName: string;
    standardClockIn: string;
    standardClockOut: string;
  } | null;
  shiftOptionIds?: string[];
  availableShifts?: ShiftOption[];
  allowShiftSelection?: boolean;
};

export function toGeoPoint(office: {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): GeoPoint {
  return {
    name: office.name,
    latitude: office.latitude,
    longitude: office.longitude,
    radiusMeters: office.radiusMeters,
  };
}
