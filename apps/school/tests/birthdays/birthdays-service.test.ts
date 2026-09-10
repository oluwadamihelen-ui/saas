import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getUpcomingBirthdays, getMonthBirthdays, searchBirthdays, schoolToday } from "@/lib/services/birthdays";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

const TIMEZONE = "UTC";
let counter = 0;

async function makeSchoolFixture() {
  counter += 1;
  const slug = `vitest-birthdays-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE", timezone: TIMEZONE } });
  const teacherRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const parentRole = await prisma.role.create({ data: { schoolId: school.id, key: "PARENT", name: "Parent" } });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 0 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  return { school, teacherRole, parentRole, classGroup, classArm, slug };
}

/// Month/day that lands `offsetDays` from "today" in TIMEZONE — computed
/// relative to the actual day the suite runs on, so these tests are
/// correct regardless of when CI executes them (never a hardcoded date).
function monthDayForOffset(offsetDays: number): { month: number; day: number } {
  const today = schoolToday(TIMEZONE);
  const target = new Date(today);
  target.setDate(target.getDate() + offsetDays);
  return { month: target.getMonth() + 1, day: target.getDate() };
}

function dobForOffset(offsetDays: number, birthYear: number): Date {
  const { month, day } = monthDayForOffset(offsetDays);
  return new Date(birthYear, month - 1, day);
}

async function makeStudent(f: Awaited<ReturnType<typeof makeSchoolFixture>>, name: string, offsetDays: number, opts: { status?: "ACTIVE" | "WITHDRAWN" | "SUSPENDED" | "GRADUATED" } = {}) {
  const [firstName, lastName] = name.split(" ");
  return prisma.student.create({
    data: {
      schoolId: f.school.id,
      classArmId: f.classArm.id,
      firstName,
      lastName,
      admissionNumber: `${f.slug}-${firstName}-${Date.now()}-${Math.random()}`,
      dateOfBirth: dobForOffset(offsetDays, 2015),
      gender: "MALE",
      status: opts.status ?? "ACTIVE",
    },
  });
}

async function makeStaff(f: Awaited<ReturnType<typeof makeSchoolFixture>>, name: string, offsetDays: number, opts: { status?: "ACTIVE" | "SUSPENDED" | "INVITED"; roleId?: string } = {}) {
  return prisma.user.create({
    data: {
      schoolId: f.school.id,
      roleId: opts.roleId ?? f.teacherRole.id,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}-${Date.now()}-${Math.random()}@vitest.local`,
      passwordHash: "x",
      name,
      dateOfBirth: dobForOffset(offsetDays, 1985),
      status: opts.status ?? "ACTIVE",
    },
  });
}

describe("getUpcomingBirthdays", () => {
  it("TEST 3 + 7: includes staff alongside students, correctly typed, and multiple same-day birthdays all appear", async () => {
    const f = await makeSchoolFixture();
    const student1 = await makeStudent(f, "Ada One", 1);
    const student2 = await makeStudent(f, "Bola Two", 1);
    const staff1 = await makeStaff(f, "Mrs Teacher", 1);

    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { limit: 10 });
    const ids = upcoming.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([student1.id, student2.id, staff1.id]));

    const staffEntry = upcoming.find((e) => e.id === staff1.id)!;
    expect(staffEntry.personType).toBe("STAFF");
    expect(staffEntry.subtitle).toBe("Teacher");

    const studentEntry = upcoming.find((e) => e.id === student1.id)!;
    expect(studentEntry.personType).toBe("STUDENT");
    expect(studentEntry.subtitle).toBe("JSS 2 A");
  });

  it("sorts chronologically, closest birthday first", async () => {
    const f = await makeSchoolFixture();
    const in10 = await makeStudent(f, "Far Student", 10);
    const in1 = await makeStudent(f, "Soon Student", 1);
    const in5 = await makeStudent(f, "Mid Student", 5);

    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { limit: 10 });
    const order = upcoming.map((e) => e.id);
    expect(order.indexOf(in1.id)).toBeLessThan(order.indexOf(in5.id));
    expect(order.indexOf(in5.id)).toBeLessThan(order.indexOf(in10.id));
  });

  it("TEST 4: a birthday today is labeled 'Today', marked isToday, and sorts first", async () => {
    const f = await makeSchoolFixture();
    const todayStudent = await makeStudent(f, "Birthday Today", 0);
    await makeStudent(f, "Tomorrow Student", 1);

    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { limit: 10 });
    expect(upcoming[0].id).toBe(todayStudent.id);
    expect(upcoming[0].isToday).toBe(true);
    expect(upcoming[0].label).toBe("Today");
  });

  it("respects the limit — 'next N people', not capped by day", async () => {
    const f = await makeSchoolFixture();
    for (let i = 0; i < 5; i++) await makeStudent(f, `Tomorrow Kid${i}`, 1);
    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { limit: 3 });
    expect(upcoming).toHaveLength(3);
  });

  it("TEST 6: excludes inactive students and suspended staff by default", async () => {
    const f = await makeSchoolFixture();
    const active = await makeStudent(f, "Active Student", 1);
    const withdrawn = await makeStudent(f, "Withdrawn Student", 1, { status: "WITHDRAWN" });
    const activeStaff = await makeStaff(f, "Active Staffer", 1);
    const suspendedStaff = await makeStaff(f, "Suspended Staffer", 1, { status: "SUSPENDED" });

    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { limit: 20 });
    const ids = upcoming.map((e) => e.id);
    expect(ids).toContain(active.id);
    expect(ids).toContain(activeStaff.id);
    expect(ids).not.toContain(withdrawn.id);
    expect(ids).not.toContain(suspendedStaff.id);
  });

  it("TEST 5: multi-school isolation — a school only ever sees its own students/staff", async () => {
    const schoolA = await makeSchoolFixture();
    const schoolB = await makeSchoolFixture();
    const studentA = await makeStudent(schoolA, "Student A", 1);
    const studentB = await makeStudent(schoolB, "Student B", 1);

    const upcomingA = await getUpcomingBirthdays(schoolA.school.id, TIMEZONE, { limit: 20 });
    const upcomingB = await getUpcomingBirthdays(schoolB.school.id, TIMEZONE, { limit: 20 });

    expect(upcomingA.map((e) => e.id)).toContain(studentA.id);
    expect(upcomingA.map((e) => e.id)).not.toContain(studentB.id);
    expect(upcomingB.map((e) => e.id)).toContain(studentB.id);
    expect(upcomingB.map((e) => e.id)).not.toContain(studentA.id);
  });

  it("excludes PARENT/STUDENT portal-login accounts from staff results even though they share the User table", async () => {
    const f = await makeSchoolFixture();
    const guardianLogin = await makeStaff(f, "Guardian Login", 1, { roleId: f.parentRole.id });

    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { types: ["STAFF"], limit: 20 });
    expect(upcoming.map((e) => e.id)).not.toContain(guardianLogin.id);
  });

  it("does not expose birth year — only month/day feed the entry", async () => {
    const f = await makeSchoolFixture();
    const student = await makeStudent(f, "Private Student", 3);
    const upcoming = await getUpcomingBirthdays(f.school.id, TIMEZONE, { limit: 20 });
    const entry = upcoming.find((e) => e.id === student.id)!;
    expect(entry).not.toHaveProperty("dateOfBirth");
    expect(entry).not.toHaveProperty("year");
  });

  it("filters by classGroupId, students-only", async () => {
    const f = await makeSchoolFixture();
    const otherGroup = await prisma.classGroup.create({ data: { schoolId: f.school.id, name: "JSS 3", order: 1 } });
    const otherArm = await prisma.classArm.create({ data: { schoolId: f.school.id, classGroupId: otherGroup.id, name: "A" } });

    const inGroup = await makeStudent(f, "In Group", 2);
    const outOfGroup = await prisma.student.create({
      data: {
        schoolId: f.school.id,
        classArmId: otherArm.id,
        firstName: "Out",
        lastName: "Group",
        admissionNumber: `${f.slug}-out-${Date.now()}`,
        dateOfBirth: dobForOffset(2, 2015),
        gender: "FEMALE",
        status: "ACTIVE",
      },
    });

    const filtered = await getUpcomingBirthdays(f.school.id, TIMEZONE, { types: ["STUDENT"], classGroupId: f.classGroup.id, limit: 20 });
    const ids = filtered.map((e) => e.id);
    expect(ids).toContain(inGroup.id);
    expect(ids).not.toContain(outOfGroup.id);
  });
});

describe("getMonthBirthdays", () => {
  it("returns only people born in the requested month, sorted by day", async () => {
    const f = await makeSchoolFixture();
    const person = await prisma.student.create({
      data: {
        schoolId: f.school.id,
        classArmId: f.classArm.id,
        firstName: "March",
        lastName: "Person",
        admissionNumber: `${f.slug}-march-${Date.now()}`,
        dateOfBirth: new Date(2015, 2, 20), // March 20
        gender: "MALE",
        status: "ACTIVE",
      },
    });
    const otherMonthPerson = await prisma.student.create({
      data: {
        schoolId: f.school.id,
        classArmId: f.classArm.id,
        firstName: "July",
        lastName: "Person",
        admissionNumber: `${f.slug}-july-${Date.now()}`,
        dateOfBirth: new Date(2015, 6, 5), // July 5
        gender: "FEMALE",
        status: "ACTIVE",
      },
    });

    const marchBirthdays = await getMonthBirthdays(f.school.id, TIMEZONE, 3);
    const ids = marchBirthdays.map((e) => e.id);
    expect(ids).toContain(person.id);
    expect(ids).not.toContain(otherMonthPerson.id);
  });
});

describe("searchBirthdays", () => {
  it("finds matching students/staff by name, case-insensitively, scoped to the school", async () => {
    const f = await makeSchoolFixture();
    const other = await makeSchoolFixture();
    const match = await makeStudent(f, "Zara Bello", 4);
    await makeStudent(f, "Someone Else", 4);
    await makeStudent(other, "Zara Bello", 4); // same name, different school

    const results = await searchBirthdays(f.school.id, TIMEZONE, "bello");
    expect(results.map((e) => e.id)).toEqual([match.id]);
  });

  it("returns an empty array for a blank query rather than the whole roster", async () => {
    const f = await makeSchoolFixture();
    await makeStudent(f, "Someone Here", 1);
    const results = await searchBirthdays(f.school.id, TIMEZONE, "   ");
    expect(results).toEqual([]);
  });
});
