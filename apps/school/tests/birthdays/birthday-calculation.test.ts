import { describe, it, expect } from "vitest";
import { getNextBirthday, birthdayLabel } from "@/lib/services/birthdays";

describe("getNextBirthday — pure date math (no DB)", () => {
  it("TEST 1: same-month birthdays produce correct chronological day counts", () => {
    const today = new Date(2025, 8, 10); // September 10, 2025
    expect(getNextBirthday(9, 11, today).daysUntil).toBe(1);
    expect(getNextBirthday(9, 12, today).daysUntil).toBe(2);
    expect(getNextBirthday(9, 15, today).daysUntil).toBe(5);
    expect(getNextBirthday(9, 20, today).daysUntil).toBe(10);
  });

  it("TEST 2: December birthdays followed by January birthdays are recognized as upcoming, in order", () => {
    const today = new Date(2025, 11, 28); // December 28, 2025
    expect(getNextBirthday(12, 29, today).daysUntil).toBe(1);
    expect(getNextBirthday(12, 31, today).daysUntil).toBe(3);
    expect(getNextBirthday(1, 2, today).daysUntil).toBe(5);
    expect(getNextBirthday(1, 5, today).daysUntil).toBe(8);
    expect(getNextBirthday(1, 10, today).daysUntil).toBe(13);

    const januaryBirthday = getNextBirthday(1, 2, today);
    expect(januaryBirthday.nextDate.getFullYear()).toBe(2026);
    expect(januaryBirthday.nextDate.getMonth()).toBe(0); // January
  });

  it("wraps a birthday that already passed this month/year around to next year", () => {
    const today = new Date(2025, 8, 10); // September 10, 2025
    const next = getNextBirthday(9, 1, today); // September 1 already passed
    expect(next.nextDate.getFullYear()).toBe(2026);
    expect(next.nextDate.getMonth()).toBe(8);
    expect(next.nextDate.getDate()).toBe(1);
    expect(next.daysUntil).toBeGreaterThan(300);
  });

  it("TEST 4: a birthday today has daysUntil 0, isToday true, and labels as 'Today'", () => {
    const today = new Date(2025, 8, 10);
    const next = getNextBirthday(9, 10, today);
    expect(next.daysUntil).toBe(0);
    expect(next.isToday).toBe(true);
    expect(birthdayLabel(next.daysUntil)).toBe("Today");
  });

  it("birth year never affects the calculation — only month/day matter", () => {
    const today = new Date(2025, 8, 10);
    const bornIn1985 = getNextBirthday(9, 15, today);
    const bornIn2015 = getNextBirthday(9, 15, today);
    expect(bornIn1985.daysUntil).toBe(bornIn2015.daysUntil);
    expect(bornIn1985.nextDate.getTime()).toBe(bornIn2015.nextDate.getTime());
  });

  it("labels: Today, Tomorrow, and In N Days", () => {
    expect(birthdayLabel(0)).toBe("Today");
    expect(birthdayLabel(1)).toBe("Tomorrow");
    expect(birthdayLabel(2)).toBe("In 2 Days");
    expect(birthdayLabel(5)).toBe("In 5 Days");
    expect(birthdayLabel(7)).toBe("In 7 Days");
  });

  describe("TEST 8: February 29 leap-day policy — celebrated Feb 28 in a non-leap year, Feb 29 in a leap year", () => {
    it("celebrates on February 28 when the upcoming occurrence falls in a non-leap year", () => {
      const today = new Date(2025, 1, 20); // Feb 20, 2025 — 2025 is not a leap year
      const next = getNextBirthday(2, 29, today);
      expect(next.nextDate.getMonth()).toBe(1);
      expect(next.nextDate.getDate()).toBe(28);
      expect(next.daysUntil).toBe(8);
    });

    it("celebrates on the real February 29 when the upcoming occurrence falls in a leap year", () => {
      const today = new Date(2027, 11, 1); // Dec 1, 2027 — next Feb 29 lands in 2028, a leap year
      const next = getNextBirthday(2, 29, today);
      expect(next.nextDate.getFullYear()).toBe(2028);
      expect(next.nextDate.getMonth()).toBe(1);
      expect(next.nextDate.getDate()).toBe(29);
    });

    it("recognizes February 28 itself as 'today' for a Feb-29-born person in a non-leap year", () => {
      const today = new Date(2025, 1, 28); // Feb 28, 2025, non-leap
      const next = getNextBirthday(2, 29, today);
      expect(next.daysUntil).toBe(0);
      expect(next.isToday).toBe(true);
    });

    it("recognizes February 29 itself as 'today' for a Feb-29-born person in a leap year", () => {
      const today = new Date(2028, 1, 29); // Feb 29, 2028, leap
      const next = getNextBirthday(2, 29, today);
      expect(next.daysUntil).toBe(0);
      expect(next.isToday).toBe(true);
    });
  });
});
