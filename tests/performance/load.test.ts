import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getClassPerformanceOverview, getSchoolPerformanceOverview } from "@/lib/services/performance/analysis";
import { cleanupTestSchools } from "../helpers/factories";
import { makeSchool } from "./helpers";

afterAll(cleanupTestSchools);

const STUDENT_COUNT = 120;

/// TEST 12 (brief): 100+ students, reasonable performance, no N+1 query
/// explosion. Query-level instrumentation isn't wired into the app's
/// Prisma singleton (see src/lib/db.ts — only "error"/"warn" logging),
/// so this proves it the practical way: fetchers.ts's design is a fixed,
/// small number of bulk queries regardless of student count (by
/// construction — none of them loop per student; see each fetcher's own
/// doc comment). If that were violated and this degraded into one (or
/// several) round-trip(s) per student instead, 120 students would blow
/// well past this bound — a flat-query design comfortably clears it.
describe("TEST 12 — large class/school performance", () => {
  it("computes a 120-student class overview within a bound consistent with a flat number of queries, not one-per-student", async () => {
    const f = await makeSchool("loadclass");

    const students = await Promise.all(
      Array.from({ length: STUDENT_COUNT }, (_, i) =>
        prisma.student.create({
          data: {
            schoolId: f.school.id,
            firstName: "Load",
            lastName: `Student${i}`,
            admissionNumber: `LOAD-${Date.now()}-${i}`,
            status: "ACTIVE",
            classArmId: f.armA.id,
          },
        })
      )
    );

    // Two subjects x two terms x 120 students = 480 score rows, plus one
    // attendance record per student for the current term.
    await prisma.score.createMany({
      data: students.flatMap((s, i) => [
        { schoolId: f.school.id, studentId: s.id, subjectId: f.mathSubject.id, termId: f.term1.id, componentId: f.component.id, value: 50 + (i % 40), enteredById: f.admin.id, classArmId: f.armA.id, classArmSource: "ENTERED" as const },
        { schoolId: f.school.id, studentId: s.id, subjectId: f.engSubject.id, termId: f.term1.id, componentId: f.component.id, value: 45 + (i % 40), enteredById: f.admin.id, classArmId: f.armA.id, classArmSource: "ENTERED" as const },
        { schoolId: f.school.id, studentId: s.id, subjectId: f.mathSubject.id, termId: f.term2.id, componentId: f.component.id, value: 55 + (i % 35), enteredById: f.admin.id, classArmId: f.armA.id, classArmSource: "ENTERED" as const },
        { schoolId: f.school.id, studentId: s.id, subjectId: f.engSubject.id, termId: f.term2.id, componentId: f.component.id, value: 50 + (i % 35), enteredById: f.admin.id, classArmId: f.armA.id, classArmSource: "ENTERED" as const },
      ]),
    });
    await prisma.attendanceRecord.createMany({
      data: students.map((s, i) => ({
        schoolId: f.school.id,
        studentId: s.id,
        classArmId: f.armA.id,
        termId: f.term2.id,
        date: new Date("2026-02-01"),
        status: i % 10 === 0 ? ("ABSENT" as const) : ("PRESENT" as const),
        markedById: f.admin.id,
      })),
    });

    const start = performance.now();
    const overview = await getClassPerformanceOverview(f.school.id, f.admin.id, f.adminPerms, f.armA.id, f.term2.id);
    const elapsedMs = performance.now() - start;

    expect(overview.studentCount).toBe(STUDENT_COUNT);
    expect(overview.students).toHaveLength(STUDENT_COUNT);
    // Every student should have a trend computed (term1 -> term2 data
    // exists for all of them) — confirms the bulk computation actually
    // ran for the full set, not a truncated sample.
    expect(overview.students.every((s) => s.trend.status !== "INSUFFICIENT_DATA")).toBe(true);

    console.log(`getClassPerformanceOverview for ${STUDENT_COUNT} students took ${elapsedMs.toFixed(0)}ms`);
    // Generous bound for a shared test-DB sandbox — a real per-student
    // N+1 (120 students x several queries each, real network round
    // trips) would be an order of magnitude slower than this.
    expect(elapsedMs).toBeLessThan(5000);
  }, 20000);

  it("computes a school-wide overview across the same 120 students within a comparable bound", async () => {
    const f = await makeSchool("loadschool");
    const students = await Promise.all(
      Array.from({ length: STUDENT_COUNT }, (_, i) =>
        prisma.student.create({
          data: { schoolId: f.school.id, firstName: "Load", lastName: `S${i}`, admissionNumber: `LOADSCH-${Date.now()}-${i}`, status: "ACTIVE", classArmId: i % 2 === 0 ? f.armA.id : f.armB.id },
        })
      )
    );
    await prisma.score.createMany({
      data: students.map((s, i) => ({
        schoolId: f.school.id,
        studentId: s.id,
        subjectId: f.mathSubject.id,
        termId: f.term2.id,
        componentId: f.component.id,
        value: 40 + (i % 50),
        enteredById: f.admin.id,
        classArmId: i % 2 === 0 ? f.armA.id : f.armB.id,
        classArmSource: "ENTERED" as const,
      })),
    });

    const start = performance.now();
    const overview = await getSchoolPerformanceOverview(f.school.id, f.admin.id, f.adminPerms, f.term2.id);
    const elapsedMs = performance.now() - start;

    expect(overview.studentsAnalyzed).toBe(STUDENT_COUNT);
    console.log(`getSchoolPerformanceOverview for ${STUDENT_COUNT} students took ${elapsedMs.toFixed(0)}ms`);
    expect(elapsedMs).toBeLessThan(5000);
  }, 20000);
});
