import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Upcoming Birthdays — computed entirely from the existing
// Student.dateOfBirth and User.dateOfBirth fields (no separate birthday
// table, nothing manually entered). Only month/day drive the calculation;
// birth year never affects "when is the next birthday" and is never
// returned to a caller.
//
// All queries below are scoped to the schoolId the caller passes in, which
// callers must derive from the authenticated session (requireSchoolUser /
// requirePermission) — never from client input. Only ACTIVE students and
// ACTIVE staff (excluding PARENT/STUDENT portal-login accounts, which live
// in the same User table but aren't staff) are included.
//
// LEAP_DAY_POLICY: a person born on February 29 has their birthday
// celebrated on February 28 in years that aren't leap years, and on
// February 29 itself in years that are. This is applied consistently by
// celebratedDate() below.
// ---------------------------------------------------------------------------

export const LEAP_DAY_POLICY =
  "A birthday on February 29 is celebrated on February 28 in non-leap years, and on February 29 in leap years.";

export type BirthdayPersonType = "STUDENT" | "STAFF";

export interface BirthdayEntry {
  id: string;
  personType: BirthdayPersonType;
  name: string;
  photoUrl: string | null;
  /// Class (students, e.g. "JSS 2 A") or role/designation (staff, e.g.
  /// "Teacher") — whichever the existing data model actually has.
  subtitle: string | null;
  month: number;
  day: number;
  nextDate: Date;
  daysUntil: number;
  isToday: boolean;
  label: string;
  /// Existing profile page to link to, or null when none exists (there is
  /// no per-staff profile page in this app yet, so staff entries aren't
  /// clickable rather than inventing a duplicate one).
  profileHref: string | null;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function celebratedDate(year: number, month: number, day: number): Date {
  if (month === 2 && day === 29 && !isLeapYear(year)) return new Date(year, 1, 28);
  return new Date(year, month - 1, day);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/// "Today" as a date-only value in the school's own configured timezone
/// (School.timezone, an IANA name like "Africa/Lagos") — not the server's.
/// The returned Date is constructed from those Y/M/D wall-clock fields
/// using the server's local Date constructor purely as a day-granularity
/// calculator; it is never compared against a real instant, only against
/// other Dates built the same way, so the server's own timezone never
/// enters the calculation.
export function schoolToday(timezone: string, at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  return new Date(Number(map.year), Number(map.month) - 1, Number(map.day));
}

export interface NextBirthday {
  nextDate: Date;
  daysUntil: number;
  isToday: boolean;
}

/// Next occurrence of birthMonth/birthDay on or after `today` (both
/// date-only values), ignoring birth year entirely. Naturally handles
/// December -> January (comparing full calendar dates, not month numbers)
/// and Feb 29 via celebratedDate's policy above.
export function getNextBirthday(birthMonth: number, birthDay: number, today: Date): NextBirthday {
  let nextDate = celebratedDate(today.getFullYear(), birthMonth, birthDay);
  if (nextDate.getTime() < today.getTime()) {
    nextDate = celebratedDate(today.getFullYear() + 1, birthMonth, birthDay);
  }
  const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / MS_PER_DAY);
  return { nextDate, daysUntil, isToday: daysUntil === 0 };
}

export function birthdayLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} Days`;
}

function sortByUpcoming(entries: BirthdayEntry[]): BirthdayEntry[] {
  return [...entries].sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Data access — a bounded, tenant-scoped, ACTIVE-only, DOB-not-null fetch
// per school (the same shape of query every other dashboard stat in this
// app already runs), decorated with the pure date math above on the
// server. Nothing here ships raw rosters to the client: only the final
// computed/sorted BirthdayEntry list crosses the RSC boundary.
// ---------------------------------------------------------------------------

interface CandidateFilters {
  types?: BirthdayPersonType[];
  classGroupId?: string;
  departmentId?: string;
  query?: string;
}

async function listBirthdayCandidates(schoolId: string, timezone: string, filters: CandidateFilters = {}): Promise<BirthdayEntry[]> {
  const types = filters.types ?? ["STUDENT", "STAFF"];
  const today = schoolToday(timezone);
  const q = filters.query?.trim();

  const [students, staff] = await Promise.all([
    types.includes("STUDENT")
      ? prisma.student.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            dateOfBirth: { not: null },
            ...(filters.classGroupId ? { classArm: { classGroupId: filters.classGroupId } } : {}),
            ...(filters.departmentId ? { classArm: { classGroup: { departmentId: filters.departmentId } } } : {}),
            ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            dateOfBirth: true,
            classArm: { select: { name: true, classGroup: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    types.includes("STAFF")
      ? prisma.user.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            dateOfBirth: { not: null },
            // PARENT/STUDENT portal-login accounts live in this same table
            // but are not staff — excluded regardless of the types filter.
            role: { key: { notIn: ["PARENT", "STUDENT"] } },
            ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
          },
          select: { id: true, name: true, avatarUrl: true, dateOfBirth: true, role: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const entries: BirthdayEntry[] = [];
  for (const s of students) {
    if (!s.dateOfBirth) continue;
    const month = s.dateOfBirth.getMonth() + 1;
    const day = s.dateOfBirth.getDate();
    const { nextDate, daysUntil, isToday } = getNextBirthday(month, day, today);
    entries.push({
      id: s.id,
      personType: "STUDENT",
      name: `${s.firstName} ${s.lastName}`,
      photoUrl: s.photoUrl,
      subtitle: s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : null,
      month,
      day,
      nextDate,
      daysUntil,
      isToday,
      label: birthdayLabel(daysUntil),
      profileHref: `/dashboard/students/${s.id}`,
    });
  }
  for (const u of staff) {
    if (!u.dateOfBirth) continue;
    const month = u.dateOfBirth.getMonth() + 1;
    const day = u.dateOfBirth.getDate();
    const { nextDate, daysUntil, isToday } = getNextBirthday(month, day, today);
    entries.push({
      id: u.id,
      personType: "STAFF",
      name: u.name,
      photoUrl: u.avatarUrl,
      subtitle: u.role.name,
      month,
      day,
      nextDate,
      daysUntil,
      isToday,
      label: birthdayLabel(daysUntil),
      profileHref: null,
    });
  }
  return entries;
}

export interface BirthdayQueryOptions {
  types?: BirthdayPersonType[];
  /// Student-only filters — ignored for staff entries (no equivalent
  /// concept exists on the User/staff model).
  classGroupId?: string;
  departmentId?: string;
  limit?: number;
}

/// The dashboard widget's data source — the next `limit` people with
/// upcoming birthdays (default 7), chronological, today's birthdays first.
/// This is "next N people", not "next N days" — a crowded day can still
/// push someone past the cutoff; the full directory page covers the rest.
export async function getUpcomingBirthdays(schoolId: string, timezone: string, opts: BirthdayQueryOptions = {}): Promise<BirthdayEntry[]> {
  const entries = await listBirthdayCandidates(schoolId, timezone, opts);
  const sorted = sortByUpcoming(entries);
  return opts.limit ? sorted.slice(0, opts.limit) : sorted;
}

/// Every birthday falling in the given calendar month (1-12), sorted by
/// day of month — for the "September Birthdays" browsing view.
export async function getMonthBirthdays(
  schoolId: string,
  timezone: string,
  month: number,
  opts: Omit<BirthdayQueryOptions, "limit"> = {}
): Promise<BirthdayEntry[]> {
  const entries = await listBirthdayCandidates(schoolId, timezone, opts);
  return entries.filter((e) => e.month === month).sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

export async function searchBirthdays(
  schoolId: string,
  timezone: string,
  query: string,
  opts: Omit<BirthdayQueryOptions, "limit"> = {}
): Promise<BirthdayEntry[]> {
  if (!query.trim()) return [];
  const entries = await listBirthdayCandidates(schoolId, timezone, { ...opts, query });
  return sortByUpcoming(entries);
}

export async function listClassGroupsForBirthdayFilter(schoolId: string) {
  return prisma.classGroup.findMany({ where: { schoolId }, orderBy: { order: "asc" }, select: { id: true, name: true } });
}

export async function listDepartmentsForBirthdayFilter(schoolId: string) {
  return prisma.department.findMany({ where: { schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
