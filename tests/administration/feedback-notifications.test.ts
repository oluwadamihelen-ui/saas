import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { submitFeedback } from "@/lib/services/feedback";
import { notifyNewFeedback } from "@/lib/services/notifications";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool() {
  counter += 1;
  const slug = `vitest-feedback-notif-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });

  const permission = await prisma.permission.upsert({
    where: { key: "feedback.view" },
    create: { key: "feedback.view", module: "administration", action: "view", description: "View feedback" },
    update: {},
  });

  const ownerRole = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  const principalRole = await prisma.role.create({ data: { schoolId: school.id, key: "PRINCIPAL", name: "Principal" } });
  const teacherRole = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: ownerRole.id, permissionId: permission.id },
      { roleId: principalRole.id, permissionId: permission.id },
    ],
  });

  const owner = await prisma.user.create({
    data: { schoolId: school.id, roleId: ownerRole.id, name: "Owner", email: `owner-${Date.now()}@vitest.local`, passwordHash: "x" },
  });
  const principal = await prisma.user.create({
    data: { schoolId: school.id, roleId: principalRole.id, name: "Principal", email: `principal-${Date.now()}@vitest.local`, passwordHash: "x" },
  });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: teacherRole.id, name: "Teacher", email: `teacher-${Date.now()}@vitest.local`, passwordHash: "x" },
  });

  return { school, owner, principal, teacher };
}

describe("notifyNewFeedback", () => {
  it("notifies every holder of feedback.view, but not the submitter", async () => {
    const { school, owner, principal, teacher } = await makeSchool();
    const feedback = await submitFeedback(school.id, teacher.id, "The library could use more storybooks.");
    await notifyNewFeedback(school.id, feedback.id, teacher.id);

    const ownerNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: owner.id } });
    const principalNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: principal.id } });
    const teacherNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: teacher.id } });

    expect(ownerNotifs).toHaveLength(1);
    expect(principalNotifs).toHaveLength(1);
    expect(teacherNotifs).toHaveLength(0); // the submitter never notifies themselves

    expect(ownerNotifs[0].type).toBe("FEEDBACK_SUBMITTED");
    expect(ownerNotifs[0].title).toBe("New feedback from Teacher");
    expect(ownerNotifs[0].body).toBe("The library could use more storybooks.");
    expect(ownerNotifs[0].link).toBe("/dashboard/administration/feedback");
    expect(ownerNotifs[0].readAt).toBeNull();
  });

  it("does not notify a submitter who also happens to hold feedback.view", async () => {
    const { school, owner, principal } = await makeSchool();
    const feedback = await submitFeedback(school.id, owner.id, "Owner submitting their own feedback.");
    await notifyNewFeedback(school.id, feedback.id, owner.id);

    const ownerNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: owner.id } });
    const principalNotifs = await prisma.notification.findMany({ where: { schoolId: school.id, userId: principal.id } });

    expect(ownerNotifs).toHaveLength(0);
    expect(principalNotifs).toHaveLength(1);
  });

  it("truncates a long message for the notification body, keeping the full message on the feedback record itself", async () => {
    const { school, teacher } = await makeSchool();
    const longMessage = "x".repeat(200);
    const feedback = await submitFeedback(school.id, teacher.id, longMessage);
    await notifyNewFeedback(school.id, feedback.id, teacher.id);

    const stored = await prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } });
    expect(stored.message).toHaveLength(200);

    const notif = await prisma.notification.findFirstOrThrow({ where: { schoolId: school.id } });
    expect(notif.body!.length).toBeLessThan(200);
    expect(notif.body!.endsWith("…")).toBe(true);
  });

  it("multi-school isolation: never notifies staff of a different school", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();
    const feedback = await submitFeedback(schoolA.school.id, schoolA.teacher.id, "School A feedback.");
    await notifyNewFeedback(schoolA.school.id, feedback.id, schoolA.teacher.id);

    const crossSchoolNotifs = await prisma.notification.findMany({ where: { userId: schoolB.owner.id } });
    expect(crossSchoolNotifs).toHaveLength(0);
  });
});
