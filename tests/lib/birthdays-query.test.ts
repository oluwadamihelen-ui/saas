import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { listBirthdays, listUpcomingBirthdays } from "@/lib/services/birthdays";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool() {
  counter += 1;
  const slug = `vitest-birthdays-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE", timezone: "Africa/Lagos" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 1 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  return { school, role, classGroup, classArm };
}

/// dateOfBirth is always parsed the same way the real create-student /
/// accept-invite forms parse an <input type="date"> value — new
/// Date("YYYY-MM-DD"), which JS resolves to UTC midnight for that
/// calendar date. Using an arbitrary, clearly-fake birth year (1990) here
/// underlines that the year is irrelevant to the calculation.
function dob(month: number, day: number, year = 1990) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function makeStudent(schoolId: string, classArmId: string, opts: { name: string; month: number; day: number; status?: "ACTIVE" | "WITHDRAWN" }) {
  const [firstName, lastName] = opts.name.split(" ");
  return prisma.student.create({
    data: {
      schoolId,
      classArmId,
      firstName,
      lastName,
      admissionNumber: `VITEST-BDAY-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dateOfBirth: dob(opts.month, opts.day),
      status: opts.status ?? "ACTIVE",
    },
  });
}

async function makeStaff(schoolId: string, roleId: string, opts: { name: string; month: number; day: number; status?: "ACTIVE" | "SUSPENDED" | "INVITED" }) {
  return prisma.user.create({
    data: {
      schoolId,
      roleId,
      name: opts.name,
      email: `${opts.name.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}.${Math.random().toString(36).slice(2)}@vitest.local`,
      passwordHash: "x",
      dateOfBirth: dob(opts.month, opts.day),
      status: opts.status ?? "ACTIVE",
    },
  });
}

describe("listBirthdays / listUpcomingBirthdays", () => {
  it("TEST 1: sorts same-month upcoming birthdays chronologically", async () => {
    const { school, classArm } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10)); // Sept 10, 2026
    await makeStudent(school.id, classArm.id, { name: "Late Twenty", month: 9, day: 20 });
    await makeStudent(school.id, classArm.id, { name: "Early Eleven", month: 9, day: 11 });
    await makeStudent(school.id, classArm.id, { name: "Mid Fifteen", month: 9, day: 15 });
    await makeStudent(school.id, classArm.id, { name: "Soon Twelve", month: 9, day: 12 });

    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result.map((p) => p.name)).toEqual(["Early Eleven", "Soon Twelve", "Mid Fifteen", "Late Twenty"]);
    expect(result.map((p) => p.daysUntil)).toEqual([1, 2, 5, 10]);
  });

  it("TEST 2: December 28 -> January birthdays correctly appear as upcoming", async () => {
    const { school, classArm } = await makeSchool();
    const today = new Date(Date.UTC(2026, 11, 28)); // Dec 28, 2026
    await makeStudent(school.id, classArm.id, { name: "January Fifth", month: 1, day: 5 });
    await makeStudent(school.id, classArm.id, { name: "December TwentyNine", month: 12, day: 29 });
    await makeStudent(school.id, classArm.id, { name: "January Second", month: 1, day: 2 });
    await makeStudent(school.id, classArm.id, { name: "December ThirtyOne", month: 12, day: 31 });

    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result.map((p) => p.name)).toEqual([
      "December TwentyNine",
      "December ThirtyOne",
      "January Second",
      "January Fifth",
    ]);
    // January birthdays must resolve into next year, not be skipped/misordered.
    expect(result.find((p) => p.name === "January Second")!.month).toBe(1);
  });

  it("TEST 3 & TEST 4: today's birthdays sort first and are flagged isToday, including multiple people on the same day", async () => {
    const { school, classArm, role } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10)); // Sept 10, 2026
    await makeStudent(school.id, classArm.id, { name: "Future Person", month: 9, day: 15 });
    await makeStudent(school.id, classArm.id, { name: "Birthday Alice", month: 9, day: 10 });
    await makeStaff(school.id, role.id, { name: "Birthday Bob", month: 9, day: 10 });

    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    const todaysPeople = result.filter((p) => p.isToday);
    expect(todaysPeople).toHaveLength(2);
    expect(todaysPeople.map((p) => p.name).sort()).toEqual(["Birthday Alice", "Birthday Bob"]);
    // Today's people must be first in the returned order.
    expect(result[0].isToday).toBe(true);
    expect(result[1].isToday).toBe(true);
    expect(result[2].name).toBe("Future Person");
  });

  it("TEST 5: multi-school isolation — each school only sees its own students/staff", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10));
    await makeStudent(schoolA.school.id, schoolA.classArm.id, { name: "Student A", month: 9, day: 11 });
    await makeStudent(schoolB.school.id, schoolB.classArm.id, { name: "Student B", month: 9, day: 11 });

    const resultA = await listUpcomingBirthdays(schoolA.school.id, "Africa/Lagos", 7, today);
    const resultB = await listUpcomingBirthdays(schoolB.school.id, "Africa/Lagos", 7, today);

    expect(resultA.map((p) => p.name)).toEqual(["Student A"]);
    expect(resultB.map((p) => p.name)).toEqual(["Student B"]);
  });

  it("TEST 6: an inactive (withdrawn) student is excluded by default", async () => {
    const { school, classArm } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10));
    await makeStudent(school.id, classArm.id, { name: "Withdrawn Student", month: 9, day: 11, status: "WITHDRAWN" });
    await makeStudent(school.id, classArm.id, { name: "Active Student", month: 9, day: 12 });

    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result.map((p) => p.name)).toEqual(["Active Student"]);
  });

  it("suspended/invited staff are excluded by default, same as withdrawn students", async () => {
    const { school, role } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10));
    await makeStaff(school.id, role.id, { name: "Suspended Staff", month: 9, day: 11, status: "SUSPENDED" });
    await makeStaff(school.id, role.id, { name: "Invited Staff", month: 9, day: 11, status: "INVITED" });
    await makeStaff(school.id, role.id, { name: "Active Staff", month: 9, day: 12 });

    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result.map((p) => p.name)).toEqual(["Active Staff"]);
  });

  it("TEST 7: staff birthdays appear alongside student birthdays, clearly typed", async () => {
    const { school, classArm, role } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10));
    await makeStudent(school.id, classArm.id, { name: "A Student", month: 9, day: 11 });
    await makeStaff(school.id, role.id, { name: "B Staffer", month: 9, day: 12 });

    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result.map((p) => ({ name: p.name, type: p.type }))).toEqual([
      { name: "A Student", type: "STUDENT" },
      { name: "B Staffer", type: "STAFF" },
    ]);
    expect(result.find((p) => p.type === "STUDENT")!.secondaryLabel).toBe("JSS 2 A");
    expect(result.find((p) => p.type === "STAFF")!.secondaryLabel).toBe("Teacher");
  });

  it("caps the dashboard widget at the requested limit even with more people upcoming", async () => {
    const { school, classArm } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10));
    for (let i = 0; i < 10; i++) {
      await makeStudent(school.id, classArm.id, { name: `Student ${i}`, month: 9, day: 11 + i });
    }
    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result).toHaveLength(7);
  });

  it("never returns a raw date-of-birth field — only month/day of the next occurrence", async () => {
    const { school, classArm } = await makeSchool();
    const today = new Date(Date.UTC(2026, 8, 10));
    await makeStudent(school.id, classArm.id, { name: "Privacy Person", month: 9, day: 11 });
    const result = await listUpcomingBirthdays(school.id, "Africa/Lagos", 7, today);
    expect(result[0]).not.toHaveProperty("dateOfBirth");
    expect(result[0]).not.toHaveProperty("year");
  });

  it("filters: type, classArmId and search narrow the directory listing", async () => {
    const { school, classArm, role } = await makeSchool();
    const otherClassGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "SS 1", order: 2 } });
    const otherClassArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: otherClassGroup.id, name: "B" } });
    const today = new Date(Date.UTC(2026, 8, 10));
    await makeStudent(school.id, classArm.id, { name: "Jss Student", month: 9, day: 11 });
    await makeStudent(school.id, otherClassArm.id, { name: "Ss Student", month: 9, day: 12 });
    await makeStaff(school.id, role.id, { name: "Some Staffer", month: 9, day: 13 });

    const studentsOnly = await listBirthdays(school.id, "Africa/Lagos", { type: "STUDENT" }, today);
    expect(studentsOnly.map((p) => p.name).sort()).toEqual(["Jss Student", "Ss Student"]);

    const staffOnly = await listBirthdays(school.id, "Africa/Lagos", { type: "STAFF" }, today);
    expect(staffOnly.map((p) => p.name)).toEqual(["Some Staffer"]);

    const byClass = await listBirthdays(school.id, "Africa/Lagos", { classArmId: classArm.id }, today);
    expect(byClass.map((p) => p.name)).toEqual(["Jss Student"]);

    const bySearch = await listBirthdays(school.id, "Africa/Lagos", { search: "staffer" }, today);
    expect(bySearch.map((p) => p.name)).toEqual(["Some Staffer"]);
  });
});
