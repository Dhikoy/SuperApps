import { prisma } from "@/lib/prisma";
import { DEFAULT_CLOCK_IN } from "@/lib/attendance-time";
import {
  allowsShiftSelection,
  parseShiftOptionIds,
  resolveShiftChoices,
  type ShiftOption,
} from "@/lib/shift-options";
import { getJakartaTodayEnd, getJakartaTodayStart } from "@/lib/timezone";
import { toGeoPoint, type UserPresensiConfig } from "@/lib/presensi-config";

type UserRow = {
  company: string | null;
  officeLocationId: string | null;
  workScheduleId: string | null;
  officeLocation: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    isActive: boolean;
  } | null;
  workSchedule: {
    id: string;
    shiftName: string;
    standardClockIn: string;
    standardClockOut: string;
    isActive: boolean;
  } | null;
};

export async function resolvePresensiForUser(
  user: UserRow
): Promise<UserPresensiConfig & { workDaysPerMonth: number }> {
  let office = user.officeLocation?.isActive ? user.officeLocation : null;
  let schedule = user.workSchedule?.isActive ? user.workSchedule : null;
  let workDaysPerMonth = 22;
  let shiftOptionIds: string[] = [];
  let availableShifts: ShiftOption[] = [];
  let allowShiftSelection = false;

  if (user.company) {
    const companyConfig = await prisma.companyPresensiConfig.findUnique({
      where: { company: user.company },
      include: {
        officeLocation: true,
        workSchedule: true,
      },
    });

    if (companyConfig) {
      workDaysPerMonth = companyConfig.workDaysPerMonth;
      shiftOptionIds = parseShiftOptionIds(companyConfig.shiftOptions);

      if (!office && companyConfig.officeLocation?.isActive) {
        office = companyConfig.officeLocation;
      }
      if (!schedule && companyConfig.workSchedule?.isActive) {
        schedule = companyConfig.workSchedule;
      }

      if (shiftOptionIds.length > 0) {
        const schedules = await prisma.workSchedule.findMany({
          where: { id: { in: shiftOptionIds }, isActive: true },
        });
        availableShifts = resolveShiftChoices(
          shiftOptionIds,
          schedules,
          companyConfig.workScheduleId
        );
        allowShiftSelection = allowsShiftSelection(shiftOptionIds);
        if (!schedule && availableShifts.length === 1) {
          const only = availableShifts[0];
          schedule = {
            id: only.id,
            shiftName: only.shiftName,
            standardClockIn: only.standardClockIn,
            standardClockOut: only.standardClockOut,
            isActive: true,
          };
        }
      }
    }
  }

  return {
    officeLocationId: office?.id ?? null,
    workScheduleId: schedule?.id ?? null,
    office: office
      ? {
          id: office.id,
          name: office.name,
          latitude: office.latitude,
          longitude: office.longitude,
          radiusMeters: office.radiusMeters,
        }
      : null,
    schedule: schedule
      ? {
          id: schedule.id,
          shiftName: schedule.shiftName,
          standardClockIn: schedule.standardClockIn,
          standardClockOut: schedule.standardClockOut,
        }
      : null,
    workDaysPerMonth,
    shiftOptionIds,
    availableShifts,
    allowShiftSelection,
  };
}

/** Semua kantor aktif grup — karyawan boleh clock in di kantor mana pun dalam radius */
export async function resolveGeoOfficesForUser(_user: UserRow) {
  const offices = await prisma.officeLocation.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return offices.map((o) => toGeoPoint(o));
}

/** Perjalanan dinas disetujui hari ini → boleh clock in tanpa geofence (luar kota) */
export async function hasApprovedBusinessTripToday(userNik: string, now = new Date()): Promise<boolean> {
  const start = getJakartaTodayStart(now);
  const end = getJakartaTodayEnd(now);

  const trip = await prisma.businessTrip.findFirst({
    where: {
      userId: userNik,
      approvalStatus: "APPROVED",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true },
  });

  return !!trip;
}

export function standardClockInFromConfig(
  schedule: { standardClockIn: string } | null | undefined
): string {
  return schedule?.standardClockIn ?? DEFAULT_CLOCK_IN;
}
