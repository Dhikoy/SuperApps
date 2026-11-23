import { toDateKey } from "@/lib/holidays";
import { iterateJakartaDates, isWorkDay } from "@/lib/workdays";

export type AttendanceAnalysisRisk = "TINGGI" | "SEDANG" | "RENDAH";

export type AnalysisAttendance = {
  date: Date;
  status: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  selfieImage: string | null;
  clockOutSelfieImage: string | null;
};

export type AnalysisEmployee = {
  nik: string;
  name: string;
  userId: string;
  company: string | null;
  joinDate: Date | null;
  employmentEndDate?: Date | null;
  workDaysPattern: "MON_FRI" | "MON_SUN";
  attendances: AnalysisAttendance[];
  approvedLeaves: { startDate: Date; endDate: Date }[];
};

export type AttendanceAnalysisRow = {
  nik: string;
  name: string;
  userId: string;
  company: string | null;
  requiredDays: number;
  clockInDays: number;
  completeDays: number;
  noClockInDays: number;
  missingClockOutDays: number;
  lateDays: number;
  clockInPhotoCount: number;
  clockOutPhotoCount: number;
  compliancePercentage: number;
  indications: string[];
  risk: AttendanceAnalysisRisk;
};

const EXCLUDED_NAMES = new Set(["andhika", "putu hadi"]);
const EXCLUDED_NIKS = new Set(["02202600000001", "02202600000002"]);

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function leaveDateKeys(leaves: AnalysisEmployee["approvedLeaves"]) {
  const keys = new Set<string>();
  for (const leave of leaves) {
    for (const day of iterateJakartaDates(leave.startDate, leave.endDate)) {
      keys.add(toDateKey(day));
    }
  }
  return keys;
}

export function analyzeAttendancePeriod(
  employees: AnalysisEmployee[],
  period: { start: Date; end: Date },
  holidayDates: Set<string>
): AttendanceAnalysisRow[] {
  return employees
    .filter(
      (employee) =>
        !EXCLUDED_NIKS.has(employee.nik) &&
        !EXCLUDED_NAMES.has(normalizeName(employee.name))
    )
    .filter(
      (employee) =>
        !employee.employmentEndDate ||
        toDateKey(employee.employmentEndDate) >= toDateKey(period.start)
    )
    .map((employee) => {
      const leaveDays = leaveDateKeys(employee.approvedLeaves);
      const attendanceByDate = new Map<string, AnalysisAttendance>();
      for (const attendance of employee.attendances) {
        const key = toDateKey(attendance.date);
        const existing = attendanceByDate.get(key);
        if (!existing || (!existing.clockInTime && attendance.clockInTime)) {
          attendanceByDate.set(key, attendance);
        }
      }

      const requiredDateKeys = iterateJakartaDates(period.start, period.end)
        .filter(
          (day) => !employee.joinDate || toDateKey(day) >= toDateKey(employee.joinDate)
        )
        .filter(
          (day) =>
            !employee.employmentEndDate ||
            toDateKey(day) <= toDateKey(employee.employmentEndDate)
        )
        .filter((day) => isWorkDay(day, employee.workDaysPattern, holidayDates))
        .map(toDateKey)
        .filter((key) => !leaveDays.has(key));

      const requiredRecords = requiredDateKeys.map((key) => attendanceByDate.get(key));
      const clockInRecords = requiredRecords.filter(
        (record): record is AnalysisAttendance => Boolean(record?.clockInTime)
      );
      const completeRecords = clockInRecords.filter((record) => Boolean(record.clockOutTime));
      const noClockInDays = requiredRecords.filter((record) => !record?.clockInTime).length;
      const missingClockOutDays = clockInRecords.filter((record) => !record.clockOutTime).length;
      const lateDays = clockInRecords.filter((record) => record.status === "TERLAMBAT").length;
      const clockInPhotoCount = clockInRecords.filter((record) => Boolean(record.selfieImage)).length;
      const clockOutPhotoCount = completeRecords.filter((record) =>
        Boolean(record.clockOutSelfieImage)
      ).length;
      const compliancePercentage =
        requiredDateKeys.length === 0
          ? 100
          : Math.round((completeRecords.length / requiredDateKeys.length) * 100);

      const indications: string[] = [];
      if (!employee.company || !employee.joinDate) {
        indications.push("Data kepegawaian perlu diverifikasi");
      }
      if (requiredDateKeys.length > 0 && clockInRecords.length === 0) {
        indications.push("Belum pernah menggunakan presensi");
      } else if (
        requiredDateKeys.length >= 3 &&
        clockInRecords.length / requiredDateKeys.length < 0.8
      ) {
        indications.push("Clock-in tidak rutin");
      }
      if (
        missingClockOutDays >= 2 &&
        missingClockOutDays / Math.max(clockInRecords.length, 1) >= 0.2
      ) {
        indications.push("Sering lupa clock-out");
      }
      if (clockInPhotoCount < clockInRecords.length) {
        indications.push("Foto masuk belum lengkap");
      }
      if (clockOutPhotoCount < completeRecords.length) {
        indications.push("Foto pulang belum lengkap");
      }

      const risk: AttendanceAnalysisRisk =
        indications.includes("Belum pernah menggunakan presensi") ||
        compliancePercentage < 50
          ? "TINGGI"
          : indications.length > 0 || compliancePercentage < 90
            ? "SEDANG"
            : "RENDAH";

      return {
        nik: employee.nik,
        name: employee.name,
        userId: employee.userId,
        company: employee.company,
        requiredDays: requiredDateKeys.length,
        clockInDays: clockInRecords.length,
        completeDays: completeRecords.length,
        noClockInDays,
        missingClockOutDays,
        lateDays,
        clockInPhotoCount,
        clockOutPhotoCount,
        compliancePercentage,
        indications,
        risk,
      };
    })
    .sort(
      (a, b) =>
        ({ TINGGI: 0, SEDANG: 1, RENDAH: 2 })[a.risk] -
          ({ TINGGI: 0, SEDANG: 1, RENDAH: 2 })[b.risk] ||
        a.compliancePercentage - b.compliancePercentage ||
        a.name.localeCompare(b.name, "id")
    );
}

export function summarizeAttendanceAnalysis(rows: AttendanceAnalysisRow[]) {
  return {
    highRisk: rows.filter((row) => row.risk === "TINGGI").length,
    mediumRisk: rows.filter((row) => row.risk === "SEDANG").length,
    neverClockedIn: rows.filter((row) =>
      row.indications.includes("Belum pernah menggunakan presensi")
    ).length,
    oftenMissingClockOut: rows.filter((row) =>
      row.indications.includes("Sering lupa clock-out")
    ).length,
  };
}
