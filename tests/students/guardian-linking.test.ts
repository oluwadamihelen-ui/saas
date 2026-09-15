import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  createStudent,
  searchGuardians,
  linkExistingGuardianToStudent,
  removeGuardianFromStudent,
  mergeGuardians,
} from "@/lib/services/students";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool() {
  counter += 1;
  const slug = `vitest-guardianlink-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  return { school };
}

describe("searchGuardians", () => {
  it("finds a guardian by name, phone or email, scoped to the school", async () => {
    const { school } = await makeSchool();
    const other = await makeSchool();
    await prisma.guardian.create({ data: { schoolId: school.id, firstName: "Ngozi", lastName: "Okafor", phone: "08011112222", email: "ngozi@example.com" } });
    await prisma.guardian.create({ data: { schoolId: other.school.id, firstName: "Ngozi", lastName: "Elsewhere", phone: "08033334444" } });

    const byName = await searchGuardians(school.id, "Ngozi");
    expect(byName).toHaveLength(1);
    expect(byName[0].lastName).toBe("Okafor");

    const byPhone = await searchGuardians(school.id, "08011112222");
    expect(byPhone).toHaveLength(1);

    const byEmail = await searchGuardians(school.id, "ngozi@example.com");
    expect(byEmail).toHaveLength(1);
  });

  it("returns nothing for a query shorter than 2 characters", async () => {
    const { school } = await makeSchool();
    await prisma.guardian.create({ data: { schoolId: school.id, firstName: "A", lastName: "B", phone: "1" } });
    expect(await searchGuardians(school.id, "A")).toEqual([]);
  });
});

describe("linkExistingGuardianToStudent", () => {
  it("links an already-existing guardian to a second student without creating a new guardian row", async () => {
    const { school } = await makeSchool();
    const studentA = await createStudent(school.id, {
      firstName: "Ada",
      lastName: "Obi",
      guardian: { firstName: "Chinedu", lastName: "Obi", phone: "08099998888", relationship: "FATHER" },
    });
    const studentB = await createStudent(school.id, { firstName: "Bola", lastName: "Obi" });

    const guardianCountBefore = await prisma.guardian.count({ where: { schoolId: school.id } });
    const [guardianA] = await prisma.studentGuardian.findMany({ where: { studentId: studentA.id } });

    await linkExistingGuardianToStudent(school.id, studentB.id, guardianA.guardianId, "FATHER");

    const guardianCountAfter = await prisma.guardian.count({ where: { schoolId: school.id } });
    expect(guardianCountAfter).toBe(guardianCountBefore); // no new Guardian row created

    const bLinks = await prisma.studentGuardian.findMany({ where: { studentId: studentB.id } });
    expect(bLinks).toHaveLength(1);
    expect(bLinks[0].guardianId).toBe(guardianA.guardianId);
  });

  it("rejects linking a guardian that's already linked to this exact student", async () => {
    const { school } = await makeSchool();
    const student = await createStudent(school.id, {
      firstName: "Ada",
      lastName: "Obi",
      guardian: { firstName: "Chinedu", lastName: "Obi", phone: "08099998888", relationship: "FATHER" },
    });
    const [link] = await prisma.studentGuardian.findMany({ where: { studentId: student.id } });

    await expect(linkExistingGuardianToStudent(school.id, student.id, link.guardianId, "FATHER")).rejects.toThrow(/already linked/);
  });

  it("rejects a guardian from another school", async () => {
    const { school } = await makeSchool();
    const other = await makeSchool();
    const guardian = await prisma.guardian.create({ data: { schoolId: other.school.id, firstName: "X", lastName: "Y", phone: "1" } });
    const student = await createStudent(school.id, { firstName: "Ada", lastName: "Obi" });

    await expect(linkExistingGuardianToStudent(school.id, student.id, guardian.id, "FATHER")).rejects.toThrow(/not found/);
  });
});

describe("removeGuardianFromStudent", () => {
  it("unlinks a guardian from one student without deleting the guardian record", async () => {
    const { school } = await makeSchool();
    const student = await createStudent(school.id, {
      firstName: "Ada",
      lastName: "Obi",
      guardian: { firstName: "Chinedu", lastName: "Obi", phone: "08099998888", relationship: "FATHER" },
    });
    const [link] = await prisma.studentGuardian.findMany({ where: { studentId: student.id } });

    await removeGuardianFromStudent(school.id, student.id, link.guardianId);

    expect(await prisma.studentGuardian.findMany({ where: { studentId: student.id } })).toHaveLength(0);
    expect(await prisma.guardian.findUnique({ where: { id: link.guardianId } })).not.toBeNull();
  });
});

describe("mergeGuardians", () => {
  it("moves the duplicate's students onto the kept guardian and deletes the duplicate", async () => {
    const { school } = await makeSchool();
    const studentA = await createStudent(school.id, {
      firstName: "Ada",
      lastName: "Obi",
      guardian: { firstName: "Chinedu", lastName: "Obi", phone: "08099998888", relationship: "FATHER" },
    });
    const studentB = await createStudent(school.id, {
      firstName: "Bola",
      lastName: "Obi",
      guardian: { firstName: "Chinedu", lastName: "Obi", phone: "08099998888", relationship: "FATHER" },
    });
    const [keepLink] = await prisma.studentGuardian.findMany({ where: { studentId: studentA.id } });
    const [dupLink] = await prisma.studentGuardian.findMany({ where: { studentId: studentB.id } });

    await mergeGuardians(school.id, keepLink.guardianId, dupLink.guardianId);

    expect(await prisma.guardian.findUnique({ where: { id: dupLink.guardianId } })).toBeNull();
    const bLinksAfter = await prisma.studentGuardian.findMany({ where: { studentId: studentB.id } });
    expect(bLinksAfter).toHaveLength(1);
    expect(bLinksAfter[0].guardianId).toBe(keepLink.guardianId);
    // studentA's own link is untouched
    const aLinksAfter = await prisma.studentGuardian.findMany({ where: { studentId: studentA.id } });
    expect(aLinksAfter).toHaveLength(1);
    expect(aLinksAfter[0].guardianId).toBe(keepLink.guardianId);
  });

  it("transfers the duplicate's portal login to the survivor when only the duplicate has one", async () => {
    const { school } = await makeSchool();
    const role = await prisma.role.create({ data: { schoolId: school.id, key: "PARENT", name: "Parent" } });
    const portalUser = await prisma.user.create({
      data: { schoolId: school.id, roleId: role.id, email: `parent-${school.id}@vitest.local`, passwordHash: "x", name: "Chinedu Obi", status: "ACTIVE" },
    });
    const keep = await prisma.guardian.create({ data: { schoolId: school.id, firstName: "Chinedu", lastName: "Obi", phone: "08099998888" } });
    const duplicate = await prisma.guardian.create({ data: { schoolId: school.id, firstName: "Chinedu", lastName: "Obi", phone: "08099998888", userId: portalUser.id } });
    const student = await createStudent(school.id, { firstName: "Bola", lastName: "Obi" });
    await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: duplicate.id, relationship: "FATHER", isPrimary: true } });

    await mergeGuardians(school.id, keep.id, duplicate.id);

    const survivor = await prisma.guardian.findUniqueOrThrow({ where: { id: keep.id } });
    expect(survivor.userId).toBe(portalUser.id);
  });

  it("rejects merging two guardians that each have their own independent portal login", async () => {
    const { school } = await makeSchool();
    const role = await prisma.role.create({ data: { schoolId: school.id, key: "PARENT2", name: "Parent" } });
    const userA = await prisma.user.create({
      data: { schoolId: school.id, roleId: role.id, email: `a-${school.id}@vitest.local`, passwordHash: "x", name: "A", status: "ACTIVE" },
    });
    const userB = await prisma.user.create({
      data: { schoolId: school.id, roleId: role.id, email: `b-${school.id}@vitest.local`, passwordHash: "x", name: "B", status: "ACTIVE" },
    });
    const guardianA = await prisma.guardian.create({ data: { schoolId: school.id, firstName: "A", lastName: "One", phone: "1", userId: userA.id } });
    const guardianB = await prisma.guardian.create({ data: { schoolId: school.id, firstName: "B", lastName: "Two", phone: "2", userId: userB.id } });

    await expect(mergeGuardians(school.id, guardianA.id, guardianB.id)).rejects.toThrow(/own portal login/);
    // Neither guardian was touched.
    expect(await prisma.guardian.findUnique({ where: { id: guardianA.id } })).not.toBeNull();
    expect(await prisma.guardian.findUnique({ where: { id: guardianB.id } })).not.toBeNull();
  });

  it("the parent portal 'my children' query now returns both students after a merge", async () => {
    const { school } = await makeSchool();
    const role = await prisma.role.create({ data: { schoolId: school.id, key: "PARENT3", name: "Parent" } });
    const portalUser = await prisma.user.create({
      data: { schoolId: school.id, roleId: role.id, email: `merged-${school.id}@vitest.local`, passwordHash: "x", name: "Parent", status: "ACTIVE" },
    });
    const keep = await prisma.guardian.create({ data: { schoolId: school.id, firstName: "P", lastName: "One", phone: "1", userId: portalUser.id } });
    const duplicate = await prisma.guardian.create({ data: { schoolId: school.id, firstName: "P", lastName: "One", phone: "1" } });
    const studentA = await createStudent(school.id, { firstName: "Kid", lastName: "One" });
    const studentB = await createStudent(school.id, { firstName: "Kid", lastName: "Two" });
    await prisma.studentGuardian.create({ data: { studentId: studentA.id, guardianId: keep.id, relationship: "FATHER", isPrimary: true } });
    await prisma.studentGuardian.create({ data: { studentId: studentB.id, guardianId: duplicate.id, relationship: "FATHER", isPrimary: true } });

    await mergeGuardians(school.id, keep.id, duplicate.id);

    const { getGuardianForUser } = await import("@/lib/services/portal");
    const result = await getGuardianForUser(school.id, portalUser.id);
    expect(result?.students.map((sg) => sg.student.id).sort()).toEqual([studentA.id, studentB.id].sort());
  });
});
