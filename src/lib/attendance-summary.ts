export type AttendanceSummaryStats = {
  totalHadir: number;
  totalTerlambat: number;
  totalIzin: number;
  totalAlpha: number;
  totalMasuk: number;
};

export function summarizeAttendances(
  records: { status: string; clockInTime: string | null }[]
): AttendanceSummaryStats {
  return {
    totalHadir: records.filter((a) => a.status === "HADIR").length,
    totalTerlambat: records.filter((a) => a.status === "TERLAMBAT").length,
    totalIzin: records.filter((a) => a.status === "IZIN").length,
    totalAlpha: records.filter((a) => a.status === "ALPHA").length,
    totalMasuk: records.filter((a) => a.clockInTime != null).length,
  };
}
