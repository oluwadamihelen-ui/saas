import "server-only";
import { prisma } from "@/lib/db";

export type BirthdayPersonType = "STUDENT" | "STAFF";

/// Month/day only — the birth year never affects when a birthday falls,
/// and is deliberately not carried on this type at all (see
/// PRIVACY note below), only whichever upcoming occurrence's day-of-month.
export interface BirthdayPerson {
  id: string;
  type: BirthdayPersonType;
  name: string;
  photoUrl: string | null;
  /// Class ("JSS 2 A") for a student. For staff, their role ("Teacher")
  /// plus the class they're the class/form teacher for, when they lead
  /// one — there's no separate staff "department" field anywhere in the
  /// schema (Department only groups ClassGroups, and is never populated
  /// by any school), so a led class arm is the one real per-staff-member
  /// group association available; nothing is fabricated to fill a
  /// department label that doesn't exist.
  secondaryLabel: string | null;
  classArmId: string | null;
  /// The next occurrence's calendar month/day — already adjusted for the
  /// Feb 29 policy below, so this is what every caller should display,
  /// sort, and group by. Never the raw stored DOB.
  month: number;
  day: number;
  daysUntil: number;
  isToday: boolean;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/// LEAP YEAR POLICY: a February 29 birthday is celebrated on February 28
/// in a non-leap year (chosen over the March 1 alternative), applied
/// consistently everywhere a birthday is sorted, grouped, or displayed —
/// never just at query time in one place. In an actual leap year, the
/// real February 29 is used.
export function celebrationDateForYear(month: number, day: number, year: number): { month: number; day: number } {
  if (month === 2 && day === 29 && !isLeapYear(year)) return { month: 2, day: 28 };
  return { month, day };
}

function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/// Resolves a recurring (month, day) birthday to its next real occurrence
/// on or after `today` — this year if it hasn't happened yet, otherwise
/// next year. Works across month and year boundaries (a December `today`
/// correctly rolls a January birthday into next year) since it compares
/// real calendar day numbers rather than reasoning about "current month"
/// at all. Only month/day of the birth date are used; the birth year is
/// irrelevant to this calculation, by design.
export function nextOccurrence(
  dob: { month: number; day: number },
  today: { year: number; month: number; day: number }
): { month: number; day: number; daysUntil: number } {
  const todayNum = dayNumber(today.year, today.month, today.day);
  for (const year of [today.year, today.year + 1]) {
    const { month, day } = celebrationDateForYear(dob.month, dob.day, year);
    const num = dayNumber(year, month, day);
    if (num >= todayNum) return { month, day, daysUntil: num - todayNum };
  }
  /* istanbul ignore next -- the year+1 candidate is always >= todayNum */
  throw new Error("unreachable: no birthday occurrence found within one year");
}

export function birthdayLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} Days`;
}

/// Reduces "now" to the school's own local calendar date rather than the
/// server's — a birthday query run right around midnight must agree with
/// what day it actually is for the school, not for whichever timezone the
/// app server happens to be deployed in.
export function schoolLocalToday(timezone: string, now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    now
  );
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

export interface BirthdayFilters {
  type?: BirthdayPersonType;
  classArmId?: string;
  search?: string;
}

/// Every active student and active staff member (school-scoped, never
/// trusting a client-supplied schoolId — callers pass the id resolved
/// from the authenticated session) who has a date of birth on file,
/// resolved to their next birthday occurrence and sorted soonest-first
/// (same-day ties broken by name, so multiple people on one date all
/// appear together in a stable order). This is the one query both the
/// dashboard widget (which takes the first 7) and the birthday directory
/// page (which filters/paginates further) build on — no separate
/// "birthday" table, no duplicated date-of-birth storage.
///
/// PRIVACY: only month/day ever leave this function — the birth year is
/// read from the stored DateTime but never attached to the returned
/// shape, so no caller can accidentally render a full date of birth from
/// this data.
export async function listBirthdays(
  schoolId: string,
  timezone: string,
  filters: BirthdayFilters = {},
  now: Date = new Date()
): Promise<BirthdayPerson[]> {
  const today = schoolLocalToday(timezone, now);
  const search = filters.search?.trim();

  const [students, staff] = await Promise.all([
    filters.type === "STAFF"
      ? Promise.resolve([])
      : prisma.student.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            dateOfBirth: { not: null },
            classArmId: filters.classArmId || undefined,
            ...(search
              ? {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { otherNames: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            otherNames: true,
            photoUrl: true,
            dateOfBirth: true,
            classArmId: true,
            classArm: { select: { name: true, classGroup: { select: { name: true } } } },
          },
        }),
    filters.type === "STUDENT"
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            dateOfBirth: { not: null },
            role: { key: { notIn: ["PARENT", "STUDENT"] } },
            ...(filters.classArmId ? { classArmsLed: { some: { id: filters.classArmId } } } : {}),
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            dateOfBirth: true,
            role: { select: { name: true } },
            classArmsLed: { select: { id: true, name: true, classGroup: { select: { name: true } } }, take: 1 },
          },
        }),
  ]);

  const people: BirthdayPerson[] = [
    ...students.map((s) => {
      const dob = s.dateOfBirth!;
      const occurrence = nextOccurrence({ month: dob.getUTCMonth() + 1, day: dob.getUTCDate() }, today);
      return {
        id: s.id,
        type: "STUDENT" as const,
        name: [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(" "),
        photoUrl: s.photoUrl,
        secondaryLabel: s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : null,
        classArmId: s.classArmId,
        ...occurrence,
        isToday: occurrence.daysUntil === 0,
      };
    }),
    ...staff.map((u) => {
      const dob = u.dateOfBirth!;
      const occurrence = nextOccurrence({ month: dob.getUTCMonth() + 1, day: dob.getUTCDate() }, today);
      const classLed = u.classArmsLed[0];
      return {
        id: u.id,
        type: "STAFF" as const,
        name: u.name,
        photoUrl: u.avatarUrl,
        secondaryLabel: classLed ? `${u.role.name} · Class Teacher, ${classLed.classGroup.name} ${classLed.name}` : u.role.name,
        classArmId: classLed?.id ?? null,
        ...occurrence,
        isToday: occurrence.daysUntil === 0,
      };
    }),
  ];

  people.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
  return people;
}

/// Convenience wrapper for the dashboard widget — the next N upcoming
/// birthdays, soonest first, across students and staff together.
export async function listUpcomingBirthdays(schoolId: string, timezone: string, limit = 7, now: Date = new Date()): Promise<BirthdayPerson[]> {
  const people = await listBirthdays(schoolId, timezone, {}, now);
  return people.slice(0, limit);
}
