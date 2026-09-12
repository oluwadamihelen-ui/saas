import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getOrCreateSchemeOfWork, addTopic, addMilestone, archiveMilestone } from "@/lib/services/scheme-of-work";
import {
  createAssessmentPeriod,
  getMilestoneAssessmentGrid,
  saveMilestoneAssessments,
  listMilestoneAssessmentHistory,
  listAssessmentLevels,
  upsertAssessmentLevelLabel,
  computePreschoolReport,
} from "@/lib/services/preschool-results";
import { cleanupTestSchools } from "../helpers/factories";
import { makePreschoolFixture, type PreschoolFixture } from "./helpers";

afterAll(cleanupTestSchools);

async function setupSchemeWithMilestones(f: PreschoolFixture) {
  const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, {
    academicSessionId: f.session.id, termId: f.term.id, classGroupId: f.classGroup.id, subjectId: f.subject.id,
  });
  const topic = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Pronouns" });
  const milestone1 = await addMilestone(f.school.id, f.teacher.id, topic.id, { title: "Identify pronouns" });
  const milestone2 = await addMilestone(f.school.id, f.teacher.id, topic.id, { title: "Underline pronouns mixed with other parts of speech" });
  return { scheme, topic, milestone1, milestone2 };
}

describe("Milestone assessment grid", () => {
  it("returns one row per active student with null values before any assessment", async () => {
    const f = await makePreschoolFixture();
    const { milestone1 } = await setupSchemeWithMilestones(f);
    const period = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });

    const grid = await getMilestoneAssessmentGrid(f.school.id, f.classArm.id, f.subject.id, f.term.id, period.id);
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].student.id).toBe(f.student.id);
    const cell = grid.rows[0].values.find((v) => v.milestoneId === milestone1.id);
    expect(cell?.level).toBeNull();
  });

  it("excludes archived milestones from the live grid", async () => {
    const f = await makePreschoolFixture();
    const { milestone1, milestone2 } = await setupSchemeWithMilestones(f);
    const period = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });
    await archiveMilestone(f.school.id, milestone2.id);

    const grid = await getMilestoneAssessmentGrid(f.school.id, f.classArm.id, f.subject.id, f.term.id, period.id);
    const ids = grid.milestones.map((m) => m.id);
    expect(ids).toContain(milestone1.id);
    expect(ids).not.toContain(milestone2.id);
  });
});

describe("Saving assessments", () => {
  it("upserts on re-save within the same period — no duplicate row", async () => {
    const f = await makePreschoolFixture();
    const { milestone1 } = await setupSchemeWithMilestones(f);
    const period = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });

    await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
      subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
      entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
    });
    await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
      subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
      entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "DEVELOPING", comment: "Improving with practice" }],
    });

    const rows = await prisma.preschoolMilestoneAssessment.findMany({ where: { studentId: f.student.id, milestoneId: milestone1.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe("DEVELOPING");
    expect(rows[0].comment).toBe("Improving with practice");
  });

  it("tracks the same milestone assessed in a different period as a distinct, non-duplicate row (section 10)", async () => {
    const f = await makePreschoolFixture();
    const { milestone1 } = await setupSchemeWithMilestones(f);
    const test = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Test", type: "TEST" });
    const exam = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Examination", type: "EXAMINATION" });

    await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
      subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: test.id,
      entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
    });
    await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
      subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: exam.id,
      entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "EXCEEDED" }],
    });

    const rows = await prisma.preschoolMilestoneAssessment.findMany({ where: { studentId: f.student.id, milestoneId: milestone1.id } });
    expect(rows).toHaveLength(2);

    const history = await listMilestoneAssessmentHistory(f.school.id, f.student.id, milestone1.id);
    expect(history).toHaveLength(2);
    expect(history[0].assessmentPeriod.name).toBe("Examination"); // most recent first
    expect(history[1].assessmentPeriod.name).toBe("Test");
  });

  it("rejects an empty save", async () => {
    const f = await makePreschoolFixture();
    await expect(
      saveMilestoneAssessments(f.school.id, f.teacher.id, false, { subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: "x", entries: [] })
    ).rejects.toThrow(/no assessments/i);
  });

  describe("cross-school id validation (IDOR prevention)", () => {
    it("rejects an entry whose studentId belongs to a different school, and writes nothing", async () => {
      const a = await makePreschoolFixture();
      const b = await makePreschoolFixture();
      const { milestone1 } = await setupSchemeWithMilestones(a);
      const period = await createAssessmentPeriod(a.school.id, a.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });

      await expect(
        saveMilestoneAssessments(a.school.id, a.teacher.id, false, {
          subjectId: a.subject.id, termId: a.term.id, assessmentPeriodId: period.id,
          entries: [{ studentId: b.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
        })
      ).rejects.toThrow(/students were not found/i);

      const rows = await prisma.preschoolMilestoneAssessment.findMany({ where: { studentId: b.student.id } });
      expect(rows).toHaveLength(0);
    });

    it("rejects an entry whose milestoneId belongs to a different school", async () => {
      const a = await makePreschoolFixture();
      const b = await makePreschoolFixture();
      const { milestone1: milestoneB } = await setupSchemeWithMilestones(b);
      const period = await createAssessmentPeriod(a.school.id, a.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });

      await expect(
        saveMilestoneAssessments(a.school.id, a.teacher.id, false, {
          subjectId: a.subject.id, termId: a.term.id, assessmentPeriodId: period.id,
          entries: [{ studentId: a.student.id, milestoneId: milestoneB.id, level: "ACHIEVED" }],
        })
      ).rejects.toThrow(/milestones were not found/i);

      const rows = await prisma.preschoolMilestoneAssessment.findMany({ where: { milestoneId: milestoneB.id } });
      expect(rows).toHaveLength(0);
    });

    it("rejects an assessmentPeriodId that belongs to a different school/term", async () => {
      const a = await makePreschoolFixture();
      const b = await makePreschoolFixture();
      const { milestone1 } = await setupSchemeWithMilestones(a);
      const periodB = await createAssessmentPeriod(b.school.id, b.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });

      await expect(
        saveMilestoneAssessments(a.school.id, a.teacher.id, false, {
          subjectId: a.subject.id, termId: a.term.id, assessmentPeriodId: periodB.id,
          entries: [{ studentId: a.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
        })
      ).rejects.toThrow(/assessment period not found/i);
    });

    it("rejects a subjectId that belongs to a different school", async () => {
      const a = await makePreschoolFixture();
      const b = await makePreschoolFixture();
      const { milestone1 } = await setupSchemeWithMilestones(a);
      const period = await createAssessmentPeriod(a.school.id, a.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });

      await expect(
        saveMilestoneAssessments(a.school.id, a.teacher.id, false, {
          subjectId: b.subject.id, termId: a.term.id, assessmentPeriodId: period.id,
          entries: [{ studentId: a.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
        })
      ).rejects.toThrow(/subject not found/i);
    });
  });

  describe("result locking (section 23)", () => {
    it("blocks an ordinary teacher from re-assessing a student whose report is already APPROVED", async () => {
      const f = await makePreschoolFixture();
      const { milestone1 } = await setupSchemeWithMilestones(f);
      const period = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });
      await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
        subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
        entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
      });

      await computePreschoolReport(f.school.id, f.student.id, f.term.id); // ensures the report row exists
      await prisma.preschoolReport.update({
        where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } },
        data: { status: "APPROVED" },
      });

      await expect(
        saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
          subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
          entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "DEVELOPING" }],
        })
      ).rejects.toThrow(/already been approved/i);

      const row = await prisma.preschoolMilestoneAssessment.findFirstOrThrow({ where: { studentId: f.student.id, milestoneId: milestone1.id } });
      expect(row.level).toBe("ACHIEVED"); // unchanged
    });

    it("lets an approver (canOverrideLock=true) override the lock", async () => {
      const f = await makePreschoolFixture();
      const { milestone1 } = await setupSchemeWithMilestones(f);
      const period = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });
      await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
        subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
        entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "ACHIEVED" }],
      });
      await computePreschoolReport(f.school.id, f.student.id, f.term.id);
      await prisma.preschoolReport.update({
        where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } },
        data: { status: "APPROVED" },
      });

      await saveMilestoneAssessments(f.school.id, f.principal.id, true, {
        subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
        entries: [{ studentId: f.student.id, milestoneId: milestone1.id, level: "DEVELOPING" }],
      });
      const row = await prisma.preschoolMilestoneAssessment.findFirstOrThrow({ where: { studentId: f.student.id, milestoneId: milestone1.id } });
      expect(row.level).toBe("DEVELOPING");
    });
  });
});

describe("Assessment scale labels", () => {
  it("falls back to default labels, then applies a school override without changing the underlying code", async () => {
    const f = await makePreschoolFixture();
    const levels = await listAssessmentLevels(f.school.id);
    const achieved = levels.find((l) => l.level === "ACHIEVED");
    expect(achieved?.label).toMatch(/Achieved/);

    await upsertAssessmentLevelLabel(f.school.id, "ACHIEVED", { label: "Very Good", colorVariant: "accent" });
    const updated = await listAssessmentLevels(f.school.id);
    const updatedAchieved = updated.find((l) => l.level === "ACHIEVED");
    expect(updatedAchieved?.label).toBe("Very Good");
    expect(updatedAchieved?.colorVariant).toBe("accent");
    expect(updatedAchieved?.level).toBe("ACHIEVED"); // the stable code never changes
  });

  it("label overrides are scoped per school", async () => {
    const a = await makePreschoolFixture();
    const b = await makePreschoolFixture();
    await upsertAssessmentLevelLabel(a.school.id, "ACHIEVED", { label: "A-School Label", colorVariant: "accent" });

    const bLevels = await listAssessmentLevels(b.school.id);
    expect(bLevels.find((l) => l.level === "ACHIEVED")?.label).not.toBe("A-School Label");
  });
});
