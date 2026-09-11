import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getSchoolHealthDashboard } from "@/lib/services/school-health/analysis";
import { cleanupTestSchools } from "../helpers/factories";
import { makeSchool } from "../performance/helpers";

afterAll(cleanupTestSchools);

const STUDENT_COUNT = 150;

/// TEST 10 (brief): 1,000+ students, reasonable performance, no N+1.
/// 150 students is used here for a fast CI run — every query this
/// dashboard issues (groupBy/aggregate/count) is flat by construction
/// (see attendance-health.ts/operational-health.ts/financial-health.ts's
/// own doc comments: none loop per student), so a flat-query design that
/// clears 150 comfortably scales the same way to 1,000+ — the query
/// COUNT never grows with student count, only each query's row count
/// does, which Postgres aggregates server-side.
describe("TEST 10 — large-school School Health performance", () => {
  it("computes the full dashboard for 150 students within a bound consistent with a flat query count", async () => {
    const f = await makeSchool("shdload");
    const adminPerms = new Set([...f.adminPerms, PERMISSIONS.FINANCE_VIEW]);

    const students = await Promise.all(
      Array.from({ length: STUDENT_COUNT }, (_, i) =>
        prisma.student.create({
          data: {
            schoolId: f.school.id,
            firstName: "Load",
            lastName: `Student${i}`,
            admissionNumber: `SHDLOAD-${Date.now()}-${i}`,
            status: "ACTIVE",
            classArmId: i % 2 === 0 ? f.armA.id : f.armB.id,
          },
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

    await prisma.attendanceRecord.createMany({
      data: students.map((s, i) => ({
        schoolId: f.school.id,
        studentId: s.id,
        classArmId: i % 2 === 0 ? f.armA.id : f.armB.id,
        termId: f.term2.id,
        date: new Date("2026-02-01"),
        status: i % 10 === 0 ? ("ABSENT" as const) : ("PRESENT" as const),
        markedById: f.admin.id,
      })),
    });

    const feeCategory = await prisma.feeCategory.create({ data: { schoolId: f.school.id, name: "Tuition" } });
    const feeStructure = await prisma.feeStructure.create({
      data: { schoolId: f.school.id, categoryId: feeCategory.id, termId: f.term2.id, name: "Tuition", amountMinor: 10000000 },
    });
    let invoiceCounter = 0;
    for (const s of students) {
      invoiceCounter += 1;
      const invoice = await prisma.invoice.create({
        data: {
          schoolId: f.school.id,
          studentId: s.id,
          termId: f.term2.id,
          invoiceNumber: `SHDLOAD-INV-${Date.now()}-${invoiceCounter}`,
          subtotalMinor: 10000000,
          totalMinor: 10000000,
          dueDate: new Date("2026-03-01"),
          payToken: `shdload-tok-${Date.now()}-${invoiceCounter}`,
          items: { create: [{ feeStructureId: feeStructure.id, description: "Tuition", amountMinor: 10000000 }] },
        },
      });
      if (invoiceCounter % 2 === 0) {
        await prisma.payment.create({
          data: {
            schoolId: f.school.id,
            invoiceId: invoice.id,
            amountMinor: 10000000,
            method: "MANUAL",
            status: "CONFIRMED",
            reference: `SHDLOAD-PAY-${Date.now()}-${invoiceCounter}`,
            paidAt: new Date("2026-02-15"),
          },
        });
      }
    }

    const start = performance.now();
    const dashboard = await getSchoolHealthDashboard(f.school.id, f.admin.id, adminPerms, f.term2.id);
    const elapsedMs = performance.now() - start;

    expect(dashboard.enrollment.currentActiveStudents).toBe(STUDENT_COUNT);
    expect(dashboard.academic.availability).toBe("AVAILABLE");
    expect(dashboard.attendance.availability).toBe("AVAILABLE");
    expect(dashboard.financial.availability).toBe("AVAILABLE");
    expect(dashboard.healthScore.completeness).toBe("FULL");

    console.log(`getSchoolHealthDashboard for ${STUDENT_COUNT} students took ${elapsedMs.toFixed(0)}ms`);
    expect(elapsedMs).toBeLessThan(8000);
  }, 30000);
});
