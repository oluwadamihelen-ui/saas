import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getOrCreateSchemeOfWork, addTopic, addMilestone } from "@/lib/services/scheme-of-work";
import {
  createAssessmentPeriod,
  saveMilestoneAssessments,
  computePreschoolReport,
  updatePreschoolReportComments,
  submitPreschoolReport,
  approvePreschoolReport,
  publishPreschoolReport,
  reopenPreschoolReport,
  listPreschoolReportsForClass,
  getClassMilestoneProgress,
} from "@/lib/services/preschool-results";
import { computeReportCard } from "@/lib/services/results";
import { cleanupTestSchools } from "../helpers/factories";
import { makePreschoolFixture } from "./helpers";

afterAll(cleanupTestSchools);

async function fullyAssessedFixture() {
  const f = await makePreschoolFixture();
  const scheme = await getOrCreateSchemeOfWork(f.school.id, f.teacher.id, {
    academicSessionId: f.session.id, termId: f.term.id, classGroupId: f.classGroup.id, subjectId: f.subject.id,
  });
  const topic = await addTopic(f.school.id, scheme.id, { weekNumber: 1, title: "Pronouns" });
  const milestone = await addMilestone(f.school.id, f.teacher.id, topic.id, { title: "Identify pronouns" });
  const period = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" });
  await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
    subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: period.id,
    entries: [{ studentId: f.student.id, milestoneId: milestone.id, level: "ACHIEVED", comment: "Confidently identifies common pronouns" }],
  });
  return { ...f, scheme, topic, milestone, period };
}

describe("Pre-School report computation", () => {
  it("computes a report with subjects/topics/milestones and a level summary", async () => {
    const f = await fullyAssessedFixture();
    const report = await computePreschoolReport(f.school.id, f.student.id, f.term.id);

    expect(report.student.id).toBe(f.student.id);
    expect(report.report.status).toBe("DRAFT");
    expect(report.totalMilestonesAssessed).toBe(1);
    expect(report.assessmentMode).toBe("MILESTONE");
    expect(report.subjects).toHaveLength(1);
    expect(report.subjects[0].subjectName).toBe("English Language");
    expect(report.subjects[0].topics[0].milestones[0]).toMatchObject({ title: "Identify pronouns", level: "ACHIEVED" });
    expect(report.summary.ACHIEVED).toBe(1);
  });

  it("shows a milestone's most recent level when assessed across multiple periods", async () => {
    const f = await fullyAssessedFixture(); // already ACHIEVED in Continuous Assessment
    const exam = await createAssessmentPeriod(f.school.id, f.term.id, { name: "Examination", type: "EXAMINATION" });
    await saveMilestoneAssessments(f.school.id, f.teacher.id, false, {
      subjectId: f.subject.id, termId: f.term.id, assessmentPeriodId: exam.id,
      entries: [{ studentId: f.student.id, milestoneId: f.milestone.id, level: "EXCEEDED" }],
    });

    const report = await computePreschoolReport(f.school.id, f.student.id, f.term.id);
    expect(report.totalMilestonesAssessed).toBe(1); // one milestone, latest state only
    expect(report.subjects[0].topics[0].milestones[0].level).toBe("EXCEEDED");
    expect(report.subjects[0].topics[0].milestones[0].assessmentPeriod).toBe("Examination");
  });

  it("throws for a student who does not belong to the given school", async () => {
    const a = await fullyAssessedFixture();
    const b = await makePreschoolFixture();
    await expect(computePreschoolReport(b.school.id, a.student.id, a.term.id)).rejects.toThrow(/not found/i);
  });
});

describe("Pre-School report workflow (Draft -> Submitted -> Approved -> Published)", () => {
  it("moves through every stage and stamps who/when", async () => {
    const f = await fullyAssessedFixture();

    await submitPreschoolReport(f.school.id, f.teacher.id, f.student.id, f.term.id);
    let report = await prisma.preschoolReport.findUniqueOrThrow({ where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } } });
    expect(report.status).toBe("SUBMITTED");
    expect(report.submittedById).toBe(f.teacher.id);
    expect(report.submittedAt).not.toBeNull();

    await approvePreschoolReport(f.school.id, f.principal.id, f.student.id, f.term.id);
    report = await prisma.preschoolReport.findUniqueOrThrow({ where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } } });
    expect(report.status).toBe("APPROVED");
    expect(report.approvedById).toBe(f.principal.id);

    await publishPreschoolReport(f.school.id, f.student.id, f.term.id);
    report = await prisma.preschoolReport.findUniqueOrThrow({ where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } } });
    expect(report.status).toBe("PUBLISHED");
    expect(report.publishedAt).not.toBeNull();
  });

  it("refuses to publish a report that has not been approved", async () => {
    const f = await fullyAssessedFixture();
    await expect(publishPreschoolReport(f.school.id, f.student.id, f.term.id)).rejects.toThrow(/must be approved/i);

    await submitPreschoolReport(f.school.id, f.teacher.id, f.student.id, f.term.id);
    await expect(publishPreschoolReport(f.school.id, f.student.id, f.term.id)).rejects.toThrow(/must be approved/i);
  });

  it("reopen resets an approved/published report back to DRAFT and clears approval/publish stamps", async () => {
    const f = await fullyAssessedFixture();
    await submitPreschoolReport(f.school.id, f.teacher.id, f.student.id, f.term.id);
    await approvePreschoolReport(f.school.id, f.principal.id, f.student.id, f.term.id);
    await publishPreschoolReport(f.school.id, f.student.id, f.term.id);

    await reopenPreschoolReport(f.school.id, f.student.id, f.term.id);
    const report = await prisma.preschoolReport.findUniqueOrThrow({ where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } } });
    expect(report.status).toBe("DRAFT");
    expect(report.approvedById).toBeNull();
    expect(report.approvedAt).toBeNull();
    expect(report.publishedAt).toBeNull();
  });

  it("stores overall/teacher/principal comments", async () => {
    const f = await fullyAssessedFixture();
    await updatePreschoolReportComments(f.school.id, f.student.id, f.term.id, {
      overallComment: "Abayo has made good progress this term.",
      teacherComment: "Keep practicing at home.",
      principalComment: "Well done.",
    });
    const report = await prisma.preschoolReport.findUniqueOrThrow({ where: { studentId_termId: { studentId: f.student.id, termId: f.term.id } } });
    expect(report.overallComment).toBe("Abayo has made good progress this term.");
    expect(report.teacherComment).toBe("Keep practicing at home.");
    expect(report.principalComment).toBe("Well done.");
  });
});

describe("Pre-School reports listing + class progress", () => {
  it("lists reports for a class scoped to school + term — null until a report row is materialized, then DRAFT", async () => {
    const f = await fullyAssessedFixture();
    const before = await listPreschoolReportsForClass(f.school.id, f.classArm.id, f.term.id);
    expect(before).toHaveLength(1);
    expect(before[0].student.id).toBe(f.student.id);
    expect(before[0].report).toBeNull(); // computePreschoolReport hasn't run yet, so no row exists

    await computePreschoolReport(f.school.id, f.student.id, f.term.id);
    const after = await listPreschoolReportsForClass(f.school.id, f.classArm.id, f.term.id);
    expect(after[0].report?.status).toBe("DRAFT");
  });

  it("does not leak another school's reports for the same class arm id shape", async () => {
    const a = await fullyAssessedFixture();
    const b = await makePreschoolFixture();
    // b's own (empty) class, listed under b's school — must never include a's data.
    const list = await listPreschoolReportsForClass(b.school.id, b.classArm.id, b.term.id);
    expect(list.every((row) => row.student.id !== a.student.id)).toBe(true);
  });

  it("summarizes class-wide milestone progress as counts, not percentages", async () => {
    const f = await fullyAssessedFixture();
    const progress = await getClassMilestoneProgress(f.school.id, f.classArm.id, f.term.id);
    expect(progress.studentCount).toBe(1);
    expect(progress.milestonesAssessed).toBe(1);
    expect(progress.byLevel.ACHIEVED).toBe(1);
  });
});

describe("Regression: numeric Grader's Results is unaffected by milestone data", () => {
  it("computeReportCard works normally on a milestone-only student with no Score rows", async () => {
    const f = await fullyAssessedFixture();
    const reportCard = await computeReportCard(f.school.id, f.student.id, f.term.id);
    expect(reportCard.subjectRows).toHaveLength(0);
    expect(reportCard.reportCard.status).toBe("DRAFT");
  });

  it("a BOTH-mode class carries a numeric Score and a milestone assessment for the same student/subject/term with no cross-contamination", async () => {
    const f = await fullyAssessedFixture();
    await prisma.classGroup.update({ where: { id: f.classGroup.id }, data: { assessmentMode: "BOTH" } });
    const component = await prisma.assessmentComponent.create({ data: { schoolId: f.school.id, name: "Exam", maxScore: 100, order: 0 } });
    await prisma.score.create({
      data: { schoolId: f.school.id, studentId: f.student.id, subjectId: f.subject.id, termId: f.term.id, componentId: component.id, value: 80, enteredById: f.teacher.id },
    });

    const reportCard = await computeReportCard(f.school.id, f.student.id, f.term.id);
    expect(reportCard.subjectRows).toHaveLength(1);
    expect(reportCard.subjectRows[0].total).toBe(80);

    const milestoneReport = await computePreschoolReport(f.school.id, f.student.id, f.term.id);
    expect(milestoneReport.totalMilestonesAssessed).toBe(1);
    expect(milestoneReport.subjects[0].topics[0].milestones[0].level).toBe("ACHIEVED");
  });
});
