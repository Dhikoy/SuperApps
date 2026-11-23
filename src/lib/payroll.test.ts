import { describe, expect, it } from "vitest";
import { summarizeAttendance, calcGajiPeriod } from "@/lib/payroll";
import { getDefaultPolicy } from "@/lib/payroll-policy";
import { timeToMinutes, resolveAttendanceStatus } from "@/lib/attendance-time";

describe("payroll", () => {
  it("summarizes attendance correctly", () => {
    const summary = summarizeAttendance([
      { status: "HADIR" },
      { status: "HADIR" },
      { status: "TERLAMBAT" },
      { status: "IZIN" },
      { status: "ALPHA" },
    ]);
    expect(summary.totalHadir).toBe(2);
    expect(summary.totalTerlambat).toBe(1);
    expect(summary.hariKerjaAktual).toBe(3);
  });

  it("calculates LBB daily payroll", () => {
    const policy = getDefaultPolicy("LBB")!;
    const result = calcGajiPeriod(5_200_000, policy, 20);
    expect(result.gajiPeriod).toBe(Math.round((5_200_000 / 26) * 20));
  });

  it("calculates BCI hourly payroll (full period)", () => {
    const policy = getDefaultPolicy("BCI")!;
    const result = calcGajiPeriod(8_650_000, policy, 22);
    expect(result.gajiPeriod).toBe(8_650_000);
  });
});

describe("attendance-time", () => {
  it("detects late clock in", () => {
    expect(resolveAttendanceStatus("09:35", "09:00")).toBe("TERLAMBAT");
    expect(resolveAttendanceStatus("08:55", "09:00")).toBe("HADIR");
  });

  it("parses time to minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
  });
});
