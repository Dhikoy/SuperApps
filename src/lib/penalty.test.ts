import { describe, expect, it } from "vitest";
import {
  deductionAmount,
  isFutureDateKey,
  parseDateKey,
  parsePenaltyNote,
  parsePenaltyPoints,
  periodKey,
  previousPeriod,
  resolvePenaltyDeduction,
} from "@/lib/penalty";

describe("penalty points", () => {
  it("accepts integer 1 to 100", () => {
    expect(parsePenaltyPoints(1)).toEqual({ points: 1 });
    expect(parsePenaltyPoints("100")).toEqual({ points: 100 });
    expect("error" in parsePenaltyPoints(0)).toBe(true);
    expect("error" in parsePenaltyPoints(101)).toBe(true);
    expect("error" in parsePenaltyPoints(1.5)).toBe(true);
  });

  it("requires a note", () => {
    expect(parsePenaltyNote("  terlambat 20 menit ")).toEqual({ note: "terlambat 20 menit" });
    expect("error" in parsePenaltyNote("   ")).toBe(true);
  });

  it("rejects a future date and an invalid calendar day", () => {
    expect(isFutureDateKey("2099-01-01", "2026-10-12")).toBe(true);
    expect(isFutureDateKey("2026-10-12", "2026-10-12")).toBe(false);
    expect(parseDateKey("2026-02-31")).toBeNull();
    expect(parseDateKey("2026-10-12")).not.toBeNull();
  });

  it("walks to the previous calendar month", () => {
    expect(previousPeriod("2026-10")).toBe("2026-09");
    expect(previousPeriod("2026-01")).toBe("2025-12");
    expect(periodKey(2026, 3)).toBe("2026-03");
  });

  it("converts locked points with a rate and rounds to the nearest rupiah", () => {
    expect(deductionAmount(3, 10000)).toBe(30000);
    expect(deductionAmount(1, 10000.4)).toBe(10000);
    const applied = resolvePenaltyDeduction({ points: 3, ratePerPoint: 10000, locked: true });
    expect(applied.amount).toBe(30000);
    expect(applied.applied).toBe(true);
    expect(applied.slipLabel).toContain("3 poin");
  });

  it("does not treat a missing rate or an open period as zero", () => {
    const open = resolvePenaltyDeduction({ points: 3, ratePerPoint: 10000, locked: false });
    expect(open.amount).toBe(0);
    expect(open.applied).toBe(false);
    expect(open.warning).toMatch(/belum dikunci/i);

    const noRate = resolvePenaltyDeduction({ points: 3, ratePerPoint: null, locked: true });
    expect(noRate.amount).toBe(0);
    expect(noRate.warning).toMatch(/belum ditentukan/i);
  });

  it("allows an explicit rate of zero once the period is locked", () => {
    const zero = resolvePenaltyDeduction({ points: 4, ratePerPoint: 0, locked: true });
    expect(zero.applied).toBe(true);
    expect(zero.amount).toBe(0);
    expect(zero.warning).toBeNull();
  });
});
