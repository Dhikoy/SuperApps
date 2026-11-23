import { describe, expect, it } from "vitest";
import {
  analyzeAttendancePeriod,
  type AnalysisEmployee,
} from "@/lib/attendance-analysis";

const date = (day: string) => new Date(`${day}T00:00:00+07:00`);
const attendance = (
  day: string,
  overrides: Partial<AnalysisEmployee["attendances"][number]> = {}
) => ({
  date: date(day),
  status: "HADIR",
  clockInTime: "08:00",
  clockOutTime: "17:00",
  selfieImage: "in.jpg",
  clockOutSelfieImage: "out.jpg",
  ...overrides,
});

function employee(overrides: Partial<AnalysisEmployee> = {}): AnalysisEmployee {
  return {
    nik: "001",
    name: "Budi",
    userId: "budi",
    company: "BCI",
    joinDate: date("2026-11-01"),
    workDaysPattern: "MON_FRI",
    attendances: [],
    approvedLeaves: [],
    ...overrides,
  };
}

describe("attendance analysis", () => {
  it("counts required workdays and ignores holidays", () => {
    const [result] = analyzeAttendancePeriod(
      [employee()],
      { start: date("2026-11-02"), end: date("2026-11-06") },
      new Set(["2026-11-04"])
    );
    expect(result.requiredDays).toBe(4);
    expect(result.noClockInDays).toBe(4);
  });

  it("does not count days before joining or approved leave", () => {
    const [result] = analyzeAttendancePeriod(
      [
        employee({
          joinDate: date("2026-11-04"),
          approvedLeaves: [{ startDate: date("2026-11-05"), endDate: date("2026-11-05") }],
        }),
      ],
      { start: date("2026-11-02"), end: date("2026-11-06") },
      new Set()
    );
    expect(result.requiredDays).toBe(2);
  });

  it("detects missing clock-out and photo completeness", () => {
    const [result] = analyzeAttendancePeriod(
      [
        employee({
          attendances: [
            attendance("2026-11-02", { clockOutTime: null, clockOutSelfieImage: null }),
            attendance("2026-11-03", { selfieImage: null }),
            attendance("2026-11-04", { clockOutTime: null, clockOutSelfieImage: null }),
          ],
        }),
      ],
      { start: date("2026-11-02"), end: date("2026-11-04") },
      new Set()
    );
    expect(result.missingClockOutDays).toBe(2);
    expect(result.clockInPhotoCount).toBe(2);
    expect(result.clockOutPhotoCount).toBe(1);
    expect(result.indications).toContain("Sering lupa clock-out");
  });

  it("classifies employees who never clocked in as high risk", () => {
    const [result] = analyzeAttendancePeriod(
      [employee()],
      { start: date("2026-11-02"), end: date("2026-11-06") },
      new Set()
    );
    expect(result.risk).toBe("TINGGI");
    expect(result.indications).toContain("Belum pernah menggunakan presensi");
  });

  it("excludes only Andhika and Putu Hadi", () => {
    const results = analyzeAttendancePeriod(
      [
        employee({ nik: "02202600000002", name: "Andhika Sulistio Pratama" }),
        employee({ nik: "02202600000001", name: "Putu Hadi Purnama Jati" }),
        employee({ nik: "3", name: "Putu Lestari" }),
      ],
      { start: date("2026-11-02"), end: date("2026-11-02") },
      new Set()
    );
    expect(results.map((row) => row.name)).toEqual(["Putu Lestari"]);
  });

  it("excludes former employees and truncates an in-period resignation", () => {
    const results = analyzeAttendancePeriod(
      [
        employee({ nik: "1", name: "Sudah Keluar", employmentEndDate: date("2026-10-31") }),
        employee({ nik: "2", name: "Keluar Tengah Bulan", employmentEndDate: date("2026-11-04") }),
      ],
      { start: date("2026-11-02"), end: date("2026-11-06") },
      new Set()
    );
    expect(results).toHaveLength(1);
    expect(results[0].requiredDays).toBe(3);
  });
});
