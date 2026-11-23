import { prisma } from "@/lib/prisma";
import { resolveAttendanceStatus } from "@/lib/attendance-time";
import { findNearestOffice, isWithinAnyOffice } from "@/lib/geo";
import {
  hasApprovedBusinessTripToday,
  resolveGeoOfficesForUser,
  resolvePresensiForUser,
  standardClockInFromConfig,
} from "@/lib/resolve-presensi";
import { getJakartaClockTime, getJakartaTodayStart } from "@/lib/timezone";
import { allowsShiftSelection, parseShiftOptionIds } from "@/lib/shift-options";
import { saveSelfieImage } from "@/lib/selfie-storage";

export type ClockResult =
  | { ok: true; attendance: unknown; status?: string }
  | { ok: false; error: string; status?: number };

type ClockInput = {
  userNik: string;
  userId: string;
  latitude: number;
  longitude: number;
  selfieImage: string;
  jamKerjaId?: string | null;
};

export async function performClockIn(input: ClockInput): Promise<ClockResult> {
  const { userNik, userId, latitude, longitude, selfieImage, jamKerjaId } = input;

  if (!selfieImage || typeof selfieImage !== "string" || !selfieImage.startsWith("data:image/")) {
    return { ok: false, error: "Foto selfie wajib diisi", status: 400 };
  }
  if (selfieImage.length > 2_000_000) {
    return { ok: false, error: "Foto terlalu besar. Coba ambil ulang dengan resolusi lebih kecil.", status: 400 };
  }
  if (latitude == null || longitude == null) {
    return { ok: false, error: "GPS wajib aktif untuk presensi", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { nik: userNik },
    include: { officeLocation: true, workSchedule: true },
  });
  if (!user) return { ok: false, error: "User tidak ditemukan", status: 404 };
  if (!user.company) {
    return { ok: false, error: "PT karyawan belum di-set. Hubungi HRD.", status: 400 };
  }

  const presensi = await resolvePresensiForUser(user);
  const geoOffices = await resolveGeoOfficesForUser(user);
  const onBusinessTrip = await hasApprovedBusinessTripToday(userNik);
  const flexibleGeo = user.flexibleAttendance;

  if (geoOffices.length === 0 && !onBusinessTrip && !flexibleGeo) {
    return { ok: false, error: "Lokasi kantor belum dikonfigurasi. Hubungi HRD.", status: 503 };
  }

  const matched =
    onBusinessTrip || flexibleGeo
      ? findNearestOffice(latitude, longitude, geoOffices)?.office ?? geoOffices[0]
      : isWithinAnyOffice(latitude, longitude, geoOffices);

  if (!matched && !onBusinessTrip && !flexibleGeo) {
    const nearest = findNearestOffice(latitude, longitude, geoOffices);
    const dist = nearest ? Math.round(nearest.distanceM) : 0;
    const officeLabel = nearest?.office.name ?? presensi.office?.name ?? user.company;
    return {
      ok: false,
      error: `Anda di luar radius semua kantor (~${dist}m dari ${officeLabel}). Pastikan GPS aktif atau ajukan perjalanan dinas.`,
      status: 400,
    };
  }

  const now = new Date();
  const today = getJakartaTodayStart(now);
  const existing = await prisma.attendance.findFirst({
    where: { userId, date: today },
  });
  if (existing) return { ok: false, error: "Sudah clock in hari ini", status: 400 };

  const clockInTime = getJakartaClockTime(now);
  const companyConfig = user.company
    ? await prisma.companyPresensiConfig.findUnique({ where: { company: user.company } })
    : null;
  const shiftOptionIds = parseShiftOptionIds(companyConfig?.shiftOptions);
  const mustPickShift = allowsShiftSelection(shiftOptionIds);

  let effectiveScheduleId = jamKerjaId || presensi.workScheduleId;
  if (mustPickShift) {
    if (!jamKerjaId || !shiftOptionIds.includes(jamKerjaId)) {
      return { ok: false, error: "Pilih shift Anda terlebih dahulu (BCG 1 / 2 / 3)", status: 400 };
    }
    effectiveScheduleId = jamKerjaId;
  }

  let standardClockIn = standardClockInFromConfig(presensi.schedule);
  if (effectiveScheduleId) {
    const schedule = await prisma.workSchedule.findUnique({ where: { id: effectiveScheduleId } });
    if (schedule) standardClockIn = schedule.standardClockIn;
  }

  const status = resolveAttendanceStatus(clockInTime, standardClockIn);
  const storedSelfie = await saveSelfieImage(selfieImage, {
    userNik,
    kind: "in",
    date: today,
  });

  const attendance = await prisma.attendance.create({
    data: {
      userId,
      jamKerjaId: effectiveScheduleId || null,
      date: today,
      clockInTime,
      latitude,
      longitude,
      selfieImage: storedSelfie,
      status,
    },
  });

  return { ok: true, attendance, status };
}

export async function performClockOut(input: Omit<ClockInput, "jamKerjaId">): Promise<ClockResult> {
  const { userNik, userId, latitude, longitude, selfieImage } = input;

  if (!selfieImage || typeof selfieImage !== "string" || !selfieImage.startsWith("data:image/")) {
    return { ok: false, error: "Foto selfie wajib diisi untuk clock out", status: 400 };
  }
  if (selfieImage.length > 2_000_000) {
    return { ok: false, error: "Foto terlalu besar. Coba ambil ulang dengan resolusi lebih kecil.", status: 400 };
  }
  if (latitude == null || longitude == null) {
    return { ok: false, error: "GPS wajib aktif untuk presensi", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { nik: userNik },
    include: { officeLocation: true, workSchedule: true },
  });
  if (!user) return { ok: false, error: "User tidak ditemukan", status: 404 };

  const geoOffices = await resolveGeoOfficesForUser(user);
  const onBusinessTrip = await hasApprovedBusinessTripToday(userNik);
  const flexibleGeo = user.flexibleAttendance;

  if (geoOffices.length === 0 && !onBusinessTrip && !flexibleGeo) {
    return { ok: false, error: "Lokasi kantor belum dikonfigurasi. Hubungi HRD.", status: 503 };
  }

  const matched =
    onBusinessTrip || flexibleGeo
      ? findNearestOffice(latitude, longitude, geoOffices)?.office ?? geoOffices[0]
      : isWithinAnyOffice(latitude, longitude, geoOffices);

  if (!matched && !onBusinessTrip && !flexibleGeo) {
    const nearest = findNearestOffice(latitude, longitude, geoOffices);
    const dist = nearest ? Math.round(nearest.distanceM) : 0;
    const officeLabel = nearest?.office.name ?? user.company;
    return {
      ok: false,
      error: `Anda di luar radius semua kantor (~${dist}m dari ${officeLabel}). Pastikan GPS aktif atau ajukan perjalanan dinas.`,
      status: 400,
    };
  }

  const now = new Date();
  const today = getJakartaTodayStart(now);
  const existing = await prisma.attendance.findFirst({
    where: { userId, date: today },
  });
  if (!existing) return { ok: false, error: "Belum clock in hari ini", status: 400 };
  if (existing.clockOutTime) return { ok: false, error: "Sudah clock out hari ini", status: 400 };

  const clockOutTime = getJakartaClockTime(now);
  const storedSelfie = await saveSelfieImage(selfieImage, {
    userNik,
    kind: "out",
    date: today,
  });

  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      clockOutTime,
      clockOutSelfieImage: storedSelfie,
      clockOutLatitude: latitude,
      clockOutLongitude: longitude,
    },
  });

  return { ok: true, attendance };
}
