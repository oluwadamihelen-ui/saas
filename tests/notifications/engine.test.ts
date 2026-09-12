import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  notifyAssignmentGradingPending,
  notifyAdminActionItems,
  setNotificationPreference,
  isCategorySuppressible,
} from "@/lib/services/notifications";
import { cleanupTestSchools } from "../helpers/factories";
import { makeNotificationsSchool } from "./helpers";

afterAll(cleanupTestSchools);

describe("notification engine — dedupe", () => {
  it("createMany skipDuplicates makes a repeat call with the same dedupeKey a no-op", async () => {
    const f = await makeNotificationsSchool("dedupe");
    const now = new Date("2026-01-10T09:00:00Z");

    await notifyAssignmentGradingPending(f.school.id, f.teacher.id, 3, now);
    await notifyAssignmentGradingPending(f.school.id, f.teacher.id, 5, now); // same day -> same dedupeKey

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.teacher.id, type: "ASSIGNMENT_GRADING_PENDING" } });
    expect(rows).toHaveLength(1);
    // The first call's body wins — a repeat run never overwrites an unread notification the user hasn't seen yet.
    expect(rows[0].body).toContain("3 submission");
  });

  it("a different dedupeKey (different day) creates a new row instead of colliding", async () => {
    const f = await makeNotificationsSchool("dedupe-day");
    await notifyAssignmentGradingPending(f.school.id, f.teacher.id, 2, new Date("2026-01-10T09:00:00Z"));
    await notifyAssignmentGradingPending(f.school.id, f.teacher.id, 2, new Date("2026-01-11T09:00:00Z"));

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.teacher.id, type: "ASSIGNMENT_GRADING_PENDING" } });
    expect(rows).toHaveLength(2);
  });

  it("NULL dedupeKey rows (the ~30 original event notifications) never collide with each other", async () => {
    const f = await makeNotificationsSchool("null-dedupe");
    await prisma.notification.createMany({
      data: [
        { schoolId: f.school.id, userId: f.admin.id, type: "MESSAGE", title: "Msg 1", category: "MESSAGING" },
        { schoolId: f.school.id, userId: f.admin.id, type: "MESSAGE", title: "Msg 2", category: "MESSAGING" },
      ],
      skipDuplicates: true,
    });
    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.admin.id, type: "MESSAGE" } });
    expect(rows).toHaveLength(2);
  });
});

describe("notification engine — priority/category persistence", () => {
  it("persists the mapped priority and category for an admin action item", async () => {
    const f = await makeNotificationsSchool("priority");
    await notifyAdminActionItems(
      f.school.id,
      [f.admin.id],
      [{ priority: "CRITICAL", category: "financial", title: "Outstanding fees", description: "desc", metric: "50%", href: "/dashboard/finance" }],
      new Date("2026-01-10T09:00:00Z")
    );
    const row = await prisma.notification.findFirstOrThrow({ where: { schoolId: f.school.id, userId: f.admin.id, type: "ADMIN_ACTION_ITEM" } });
    expect(row.priority).toBe("CRITICAL");
    expect(row.category).toBe("FEES");
    expect(row.actionLabel).toBe("View details");
  });
});

describe("notification engine — preference suppression", () => {
  it("does not create a notification for a user who muted that suppressible category", async () => {
    const f = await makeNotificationsSchool("mute");
    await setNotificationPreference(f.school.id, f.teacher.id, "ASSIGNMENT", false);

    await notifyAssignmentGradingPending(f.school.id, f.teacher.id, 4, new Date("2026-01-10T09:00:00Z"));

    const rows = await prisma.notification.findMany({ where: { schoolId: f.school.id, userId: f.teacher.id, type: "ASSIGNMENT_GRADING_PENDING" } });
    expect(rows).toHaveLength(0);
  });

  it("SYSTEM is never suppressible, even if a preference row somehow disables it", async () => {
    expect(isCategorySuppressible("SYSTEM")).toBe(false);
    expect(isCategorySuppressible("ASSIGNMENT")).toBe(true);
  });
});
