import { describe, it, expect } from "vitest";
import { isLeapYear, celebrationDateForYear, nextOccurrence, birthdayLabel, schoolLocalToday } from "@/lib/services/birthdays";

describe("isLeapYear", () => {
  it("identifies leap and non-leap years, including the century exceptions", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
    expect(isLeapYear(1900)).toBe(false); // divisible by 100, not 400
  });
});

describe("celebrationDateForYear (Feb 29 policy)", () => {
  it("keeps Feb 29 in an actual leap year", () => {
    expect(celebrationDateForYear(2, 29, 2024)).toEqual({ month: 2, day: 29 });
  });

  it("moves Feb 29 to Feb 28 in a non-leap year", () => {
    expect(celebrationDateForYear(2, 29, 2026)).toEqual({ month: 2, day: 28 });
    expect(celebrationDateForYear(2, 29, 1900)).toEqual({ month: 2, day: 28 });
  });

  it("leaves every other date untouched", () => {
    expect(celebrationDateForYear(9, 12, 2026)).toEqual({ month: 9, day: 12 });
    expect(celebrationDateForYear(2, 28, 2026)).toEqual({ month: 2, day: 28 });
  });
});

describe("nextOccurrence — chronological, cross-month, cross-year", () => {
  it("TEST 1: same-month birthdays after today, in chronological order", () => {
    const today = { year: 2026, month: 9, day: 10 };
    const days = [11, 12, 15, 20].map((day) => nextOccurrence({ month: 9, day }, today).daysUntil);
    expect(days).toEqual([1, 2, 5, 10]);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it("TEST 2: December 28 -> January birthdays correctly recognized as upcoming, in order", () => {
    const today = { year: 2026, month: 12, day: 28 };
    const cases = [
      { month: 12, day: 29, expectDays: 1 },
      { month: 12, day: 31, expectDays: 3 },
      { month: 1, day: 2, expectDays: 5 },
      { month: 1, day: 5, expectDays: 8 },
      { month: 1, day: 10, expectDays: 13 },
    ];
    for (const c of cases) {
      const result = nextOccurrence({ month: c.month, day: c.day }, today);
      expect(result.daysUntil).toBe(c.expectDays);
      expect(result.month).toBe(c.month);
      expect(result.day).toBe(c.day);
    }
    const sorted = cases.map((c) => c.expectDays);
    expect([...sorted].sort((a, b) => a - b)).toEqual(sorted);
  });

  it("a birthday today resolves to daysUntil 0", () => {
    const today = { year: 2026, month: 9, day: 10 };
    expect(nextOccurrence({ month: 9, day: 10 }, today).daysUntil).toBe(0);
  });

  it("a birthday earlier this month/year rolls forward to next year, not negative", () => {
    const today = { year: 2026, month: 9, day: 10 };
    const result = nextOccurrence({ month: 1, day: 1 }, today);
    expect(result.daysUntil).toBeGreaterThan(0);
    expect(result.month).toBe(1);
    expect(result.day).toBe(1);
  });

  it("ignores the birth year entirely — only month/day drive the calculation", () => {
    const today = { year: 2026, month: 9, day: 10 };
    const old = nextOccurrence({ month: 9, day: 12 }, today);
    const young = nextOccurrence({ month: 9, day: 12 }, today);
    expect(old).toEqual(young);
  });

  it("TEST 8: Feb 29 birthday resolves via the Feb 28 non-leap policy", () => {
    // 2026 is not a leap year — Feb 29 should resolve to Feb 28 that year.
    const today = { year: 2026, month: 2, day: 1 };
    const result = nextOccurrence({ month: 2, day: 29 }, today);
    expect(result).toEqual({ month: 2, day: 28, daysUntil: 27 });
  });

  it("TEST 8b: Feb 29 birthday lands on the real Feb 29 in a leap year", () => {
    const today = { year: 2024, month: 2, day: 1 };
    const result = nextOccurrence({ month: 2, day: 29 }, today);
    expect(result).toEqual({ month: 2, day: 29, daysUntil: 28 });
  });

  it("end of month: Jan 31 birthday from Jan 30 is tomorrow", () => {
    const today = { year: 2026, month: 1, day: 30 };
    expect(nextOccurrence({ month: 1, day: 31 }, today).daysUntil).toBe(1);
  });
});

describe("birthdayLabel", () => {
  it("uses friendly labels for today/tomorrow and 'In N Days' otherwise", () => {
    expect(birthdayLabel(0)).toBe("Today");
    expect(birthdayLabel(1)).toBe("Tomorrow");
    expect(birthdayLabel(2)).toBe("In 2 Days");
    expect(birthdayLabel(7)).toBe("In 7 Days");
  });
});

describe("schoolLocalToday", () => {
  it("reduces a UTC instant to the correct calendar date in a positive-offset timezone", () => {
    // 2026-01-01T23:30:00Z is already 2026-01-02 in Africa/Lagos (UTC+1)...
    // Lagos is UTC+1, so 23:30 UTC + 1h = 00:30 next day.
    const result = schoolLocalToday("Africa/Lagos", new Date("2026-01-01T23:30:00Z"));
    expect(result).toEqual({ year: 2026, month: 1, day: 2 });
  });

  it("reduces a UTC instant to the correct calendar date in a negative-offset timezone", () => {
    // 2026-01-01T02:00:00Z is still 2025-12-31 in America/New_York (UTC-5).
    const result = schoolLocalToday("America/New_York", new Date("2026-01-01T02:00:00Z"));
    expect(result).toEqual({ year: 2025, month: 12, day: 31 });
  });
});
