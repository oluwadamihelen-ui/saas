import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertClassSubjectAccess,
  getOrCreateSchemeOfWork,
  addTopic,
  updateTopic,
  deleteTopic,
  addMilestone,
  updateMilestone,
  archiveMilestone,
  restoreMilestone,
  updateClassGroupAssessmentMode,
} from "@/lib/services/scheme-of-work";
import { cleanupTestSchools } from "../helpers/factories";
import { makePreschoolFixture, type PreschoolFixture } from "./helpers";

afterAll(cleanupTestSchools);

function schemeInput(f: PreschoolFixture) {
  return { academicSessionId: f.session.id, termId: f.term.id, classGroupId: f.classGroup.id, subjectId: f.subject.id };
}

describe("Scheme of Work", () => {
  it("creates a scheme of work and is idempotent for the same session/term/class/subject", async () => {
    const f = await makePreschoolFixture();
    const scheme1 = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    const scheme2 = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    expect(scheme2.id).toBe(scheme1.id);
  });

  it("rejects an unknown session/term/class/subject", async () => {
    const f = await makePreschoolFixture();
    await expect(
      getOrCreateSchemeOfWork(f.school.id, f.teacher.id, { ...schemeInput(f), subjectId: "nonexistent" })
    ).rejects.toThrow(/select a valid/i);
  });

  it("adds topics by week and rejects a duplicate week number", async () => {
    const f = await makePreschoolFixture();
    const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    const topic1 = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Pronouns" });
    expect(topic1.weekNumber).toBe(1);
    expect(topic1.title).toBe("Pronouns");
    await expect(addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Duplicate" })).rejects.toThrow(/already has a topic/i);
  });

  it("updates a topic's title and week number", async () => {
    const f = await makePreschoolFixture();
    const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    const topic = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Pronouns" });
    const updated = await updateTopic(f.school.id, topic.id, { title: "Pronouns (revised)" });
    expect(updated.title).toBe("Pronouns (revised)");
    expect(updated.weekNumber).toBe(1);
  });

  it("only deletes a topic once it has no milestones — archiving a milestone does not clear the way", async () => {
    const f = await makePreschoolFixture();
    const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    const emptyTopic = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Empty week" });
    await expect(deleteTopic(f.school.id, emptyTopic.id)).resolves.not.toThrow();

    const topic = await addTopic(f.school.id, scheme.id, { weekNumber: 2, title: "Adjectives" });
    const milestone = await addMilestone(f.school.id, f.teacher.id, topic.id, { title: "Make sentences using adjectives" });
    await expect(deleteTopic(f.school.id, topic.id)).rejects.toThrow(/archive/i);
    await archiveMilestone(f.school.id, milestone.id);
    await expect(deleteTopic(f.school.id, topic.id)).rejects.toThrow(/archive/i);
  });

  it("creates a milestone as ACTIVE, archives it, and restores it — a milestone is never deleted", async () => {
    const f = await makePreschoolFixture();
    const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    const topic = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Pronouns" });
    const milestone = await addMilestone(f.school.id, f.teacher.id, topic.id, { title: "Identify pronouns" });
    expect(milestone.status).toBe("ACTIVE");

    const archived = await archiveMilestone(f.school.id, milestone.id);
    expect(archived.status).toBe("ARCHIVED");

    const restored = await restoreMilestone(f.school.id, milestone.id);
    expect(restored.status).toBe("ACTIVE");

    // Still the very same row throughout — never recreated.
    const stillThere = await prisma.preschoolMilestone.findUniqueOrThrow({ where: { id: milestone.id } });
    expect(stillThere.id).toBe(milestone.id);
  });

  it("updates a milestone's title and description", async () => {
    const f = await makePreschoolFixture();
    const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, schemeInput(f));
    const topic = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Pronouns" });
    const milestone = await addMilestone(f.school.id, f.teacher.id, topic.id, { title: "Identify pronouns" });
    const updated = await updateMilestone(f.school.id, milestone.id, { description: "Recognize common pronouns in a sentence" });
    expect(updated.description).toBe("Recognize common pronouns in a sentence");
    expect(updated.title).toBe("Identify pronouns");
  });

  describe("teacher scoping (assertClassSubjectAccess)", () => {
    it("throws for a TEACHER with no TeacherAssignment for the class+subject", async () => {
      const f = await makePreschoolFixture();
      await expect(
        assertClassSubjectAccess(f.school.id, { id: f.teacher.id, role: "TEACHER" }, f.classArm.id, f.subject.id)
      ).rejects.toThrow(/not assigned/i);
    });

    it("passes for a TEACHER with a matching TeacherAssignment", async () => {
      const f = await makePreschoolFixture();
      await prisma.teacherAssignment.create({ data: { schoolId: f.school.id, teacherId: f.teacher.id, subjectId: f.subject.id, classArmId: f.classArm.id } });
      await expect(
        assertClassSubjectAccess(f.school.id, { id: f.teacher.id, role: "TEACHER" }, f.classArm.id, f.subject.id)
      ).resolves.toBeUndefined();
    });

    it("does not narrow access for a non-TEACHER role (already cleared a school-wide permission)", async () => {
      const f = await makePreschoolFixture();
      await expect(
        assertClassSubjectAccess(f.school.id, { id: f.principal.id, role: "PRINCIPAL" }, f.classArm.id, f.subject.id)
      ).resolves.toBeUndefined();
    });
  });

  describe("tenant isolation", () => {
    it("cannot add a topic to another school's scheme of work", async () => {
      const a = await makePreschoolFixture();
      const b = await makePreschoolFixture();
      const schemeA = await getOrCreateSchemeOfWork(a.school.id, a.teacher.id, schemeInput(a));
      await expect(addTopic(b.school.id, schemeA.id, { weekNumber: 1, title: "Intrusion" })).rejects.toThrow(/not found/i);
    });

    it("cannot archive or restore another school's milestone", async () => {
      const a = await makePreschoolFixture();
      const b = await makePreschoolFixture();
      const schemeA = await getOrCreateSchemeOfWork(a.school.id, a.teacher.id, schemeInput(a));
      const topicA = await addTopic(a.school.id, schemeA.id, { weekNumber: 1, title: "Pronouns" });
      const milestoneA = await addMilestone(a.school.id, a.teacher.id, topicA.id, { title: "Identify pronouns" });

      await expect(archiveMilestone(b.school.id, milestoneA.id)).rejects.toThrow(/not found/i);
      await expect(restoreMilestone(b.school.id, milestoneA.id)).rejects.toThrow(/not found/i);

      const unchanged = await prisma.preschoolMilestone.findUniqueOrThrow({ where: { id: milestoneA.id } });
      expect(unchanged.status).toBe("ACTIVE");
    });
  });

  it("updateClassGroupAssessmentMode updates the mode and rejects an unknown class", async () => {
    const f = await makePreschoolFixture();
    const updated = await updateClassGroupAssessmentMode(f.school.id, f.classGroup.id, "BOTH");
    expect(updated.assessmentMode).toBe("BOTH");
    await expect(updateClassGroupAssessmentMode(f.school.id, "nonexistent", "MILESTONE")).rejects.toThrow(/not found/i);
  });

  it("cannot change another school's class assessment mode", async () => {
    const a = await makePreschoolFixture();
    const b = await makePreschoolFixture();
    await expect(updateClassGroupAssessmentMode(b.school.id, a.classGroup.id, "BOTH")).rejects.toThrow(/not found/i);
    const unchanged = await prisma.classGroup.findUniqueOrThrow({ where: { id: a.classGroup.id } });
    expect(unchanged.assessmentMode).toBe("MILESTONE");
  });
});
