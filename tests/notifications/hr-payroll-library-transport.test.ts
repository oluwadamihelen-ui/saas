import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { maybeRunNotificationRules } from "@/lib/services/notification-rules";
import { assignStudentToRoute, unassignStudentFromRoute } from "@/lib/services/transport";
import { generatePayrollRun, approvePayrollRun, markPayrollRunPaid } from "@/lib/services/payroll";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;

/// A minimal school + one staff member holding every permission these four
/// rule groups check for (library.view, staff.manage, transport.view,
/// payroll.approve/manage) — enough to exercise each notification without
/// pulling in the full Notification Center fixture these rules don't need.
async function makeSchool(namePrefix: string) {
  counter += 1;
  const slug = `vitest-hrops-${namePrefix}-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const permission = async (key: string, module: string) =>
    prisma.permission.upsert({ where: { key }, create: { key, module, action: key.split(".")[1], description: key }, update: {} });

  const perms = await Promise.all([
    permission(PERMISSIONS.LIBRARY_VIEW, "library"),
    permission(PERMISSIONS.STAFF_MANAGE, "staff"),
    permission(PERMISSIONS.TRANSPORT_VIEW, "transport"),
    permission(PERMISSIONS.PAYROLL_APPROVE, "payroll"),
    permission(PERMISSIONS.PAYROLL_MANAGE, "payroll"),
  ]);

  const opsRole = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: opsRole.id, permissionId: p.id })) });

  const noPermsRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });

  const ops = await prisma.user.create({
    data: { schoolId: school.id, roleId: opsRole.id, email: `ops-${slug}@vitest.local`, passwordHash: "x", name: "Ops", status: "ACTIVE" },
  });
  const bystander = await prisma.user.create({
    data: { schoolId: school.id, roleId: noPermsRole.id, email: `bystander-${slug}@vitest.local`, passwordHash: "x", name: "Bystander", status: "ACTIVE" },
  });

  return { school, ops, bystander };
}

describe("notification rules — library overdue/due-tomorrow digest", () => {
  it("notifies a library.view holder about overdue books but not a user with no permission", async () => {
    const { school, ops, bystander } = await makeSchool("library");
    const book = await prisma.book.create({ data: { schoolId: school.id, title: "Things Fall Apart", author: "Chinua Achebe" } });
    await prisma.bookLoan.create({
      data: {
        schoolId: school.id,
        bookId: book.id,
        borrowerUserId: bystander.id,
        issuedById: ops.id,
        dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: "ISSUED",
      },
    });

    await maybeRunNotificationRules(school.id);

    const opsNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "LIBRARY_BOOKS_OVERDUE" } });
    const bystanderNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: bystander.id, type: "LIBRARY_BOOKS_OVERDUE" } });
    expect(opsNotifs).toHaveLength(1);
    expect(opsNotifs[0].title.toLowerCase()).toContain("overdue");
    expect(bystanderNotifs).toHaveLength(0);
  });

  it("dedupes to one notification per day across repeated scans", async () => {
    const { school, ops } = await makeSchool("library-dedup");
    const book = await prisma.book.create({ data: { schoolId: school.id, title: "Book", author: "Author" } });
    await prisma.bookLoan.create({
      data: { schoolId: school.id, bookId: book.id, borrowerUserId: ops.id, issuedById: ops.id, dueAt: new Date(Date.now() - 1000), status: "ISSUED" },
    });

    await maybeRunNotificationRules(school.id);
    await prisma.school.update({ where: { id: school.id }, data: { notificationRulesLastRunAt: new Date(Date.now() - 20 * 60 * 1000) } });
    await maybeRunNotificationRules(school.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: school.id, type: "LIBRARY_BOOKS_OVERDUE" } });
    expect(rows).toHaveLength(1);
  });
});

describe("notification rules — staff invite pending too long", () => {
  it("notifies a staff.manage holder about a stale pending invite but not a fresh one", async () => {
    const { school, ops } = await makeSchool("staff-invite");
    const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER_INVITE_TARGET", name: "Teacher" } });

    await prisma.staffInvite.create({
      data: {
        schoolId: school.id,
        email: `stale-${school.id}@vitest.local`,
        roleId: role.id,
        token: `tok-stale-${school.id}`,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: ops.id,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });

    await maybeRunNotificationRules(school.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "STAFF_INVITE_PENDING" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toContain("1 staff invite");
  });

  it("does not flag an invite sent moments ago", async () => {
    const { school, ops } = await makeSchool("staff-invite-fresh");
    const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER_INVITE_TARGET2", name: "Teacher" } });
    await prisma.staffInvite.create({
      data: {
        schoolId: school.id,
        email: `fresh-${school.id}@vitest.local`,
        roleId: role.id,
        token: `tok-fresh-${school.id}`,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: ops.id,
      },
    });

    await maybeRunNotificationRules(school.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "STAFF_INVITE_PENDING" } });
    expect(rows).toHaveLength(0);
  });
});

describe("Transport — student unassigned from route (event-triggered)", () => {
  it("notifies a transport.view holder when a student is explicitly unassigned", async () => {
    const { school, ops } = await makeSchool("transport-unassign");
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 1", order: 1 } });
    const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Ada", lastName: "Obi", admissionNumber: `ADM-${school.id}`, status: "ACTIVE", classArmId: classArm.id },
    });
    const route = await prisma.transportRoute.create({ data: { schoolId: school.id, name: "Route A" } });
    const assignment = await assignStudentToRoute(school.id, student.id, route.id);

    await unassignStudentFromRoute(school.id, assignment.id);

    const rows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "TRANSPORT_STUDENT_UNASSIGNED" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toContain("Ada Obi");
    expect(rows[0].body).toContain("Route A");
  });

  it("does not fire when a student is simply moved to a different route", async () => {
    const { school, ops } = await makeSchool("transport-switch");
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 1", order: 1 } });
    const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
    const student = await prisma.student.create({
      data: { schoolId: school.id, firstName: "Bola", lastName: "Ade", admissionNumber: `ADM2-${school.id}`, status: "ACTIVE", classArmId: classArm.id },
    });
    const routeA = await prisma.transportRoute.create({ data: { schoolId: school.id, name: "Route A" } });
    const routeB = await prisma.transportRoute.create({ data: { schoolId: school.id, name: "Route B" } });

    await assignStudentToRoute(school.id, student.id, routeA.id);
    await assignStudentToRoute(school.id, student.id, routeB.id); // ends the Route A assignment internally

    const rows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "TRANSPORT_STUDENT_UNASSIGNED" } });
    expect(rows).toHaveLength(0);
  });
});

describe("Payroll — run ready for approval + payslip available (event-triggered)", () => {
  it("notifies a payroll.approve holder once a run is generated, then notifies the staff member once it's paid", async () => {
    const { school, ops } = await makeSchool("payroll");
    const component = await prisma.salaryComponent.create({ data: { schoolId: school.id, name: "Basic", type: "EARNING" } });
    const staffRole = await prisma.role.create({ data: { schoolId: school.id, key: "STAFF_MEMBER", name: "Staff" } });
    const staff = await prisma.user.create({
      data: { schoolId: school.id, roleId: staffRole.id, email: `staff-${school.id}@vitest.local`, passwordHash: "x", name: "Staff Member", status: "ACTIVE" },
    });
    await prisma.staffSalaryStructure.create({
      data: { schoolId: school.id, userId: staff.id, items: { create: [{ componentId: component.id, amountMinor: 50000000 }] } },
    });

    const run = await generatePayrollRun(school.id, 1, 2026, ops.id);

    const readyRows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "PAYROLL_RUN_READY_FOR_APPROVAL" } });
    expect(readyRows).toHaveLength(1);
    expect(readyRows[0].title.toLowerCase()).toContain("approval");

    await approvePayrollRun(school.id, ops.id, run.id);
    await markPayrollRunPaid(school.id, run.id);

    const payslipRows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: staff.id, type: "PAYSLIP_AVAILABLE" } });
    expect(payslipRows).toHaveLength(1);
    expect(payslipRows[0].link).toBeNull();
  });

  it("does not re-notify approvers when a still-draft run is regenerated", async () => {
    const { school, ops } = await makeSchool("payroll-regen");
    const component = await prisma.salaryComponent.create({ data: { schoolId: school.id, name: "Basic", type: "EARNING" } });
    const staffRole = await prisma.role.create({ data: { schoolId: school.id, key: "STAFF_MEMBER2", name: "Staff" } });
    const staff = await prisma.user.create({
      data: { schoolId: school.id, roleId: staffRole.id, email: `staff2-${school.id}@vitest.local`, passwordHash: "x", name: "Staff Member", status: "ACTIVE" },
    });
    await prisma.staffSalaryStructure.create({
      data: { schoolId: school.id, userId: staff.id, items: { create: [{ componentId: component.id, amountMinor: 30000000 }] } },
    });

    await generatePayrollRun(school.id, 2, 2026, ops.id);
    await generatePayrollRun(school.id, 2, 2026, ops.id); // same month/year -> same run, re-generated

    const rows = await prisma.notification.findMany({ where: { schoolId: school.id, userId: ops.id, type: "PAYROLL_RUN_READY_FOR_APPROVAL" } });
    expect(rows).toHaveLength(1);
  });
});
