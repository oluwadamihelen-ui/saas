import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  listNotificationsPage,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  hasExpiredNotifications,
  clearExpiredNotifications,
  getNotificationPreferences,
  setNotificationPreference,
  PREFERENCE_TOGGLEABLE_CATEGORIES,
} from "@/lib/services/notifications";
import { cleanupTestSchools } from "../helpers/factories";
import { makeNotificationsSchool } from "./helpers";

afterAll(cleanupTestSchools);

async function seed(schoolId: string, userId: string) {
  await prisma.notification.createMany({
    data: [
      { schoolId, userId, type: "ASSIGNMENT_CREATED", title: "Assignment A", category: "ASSIGNMENT", priority: "MEDIUM" },
      { schoolId, userId, type: "ATTENDANCE_CONCERN", title: "Attendance concern", category: "ATTENDANCE", priority: "HIGH" },
      { schoolId, userId, type: "FEES_OUTSTANDING", title: "Fees due", category: "FEES", priority: "CRITICAL", readAt: new Date() },
      { schoolId, userId, type: "PAYMENT_CONFIRMED", title: "Payment received", category: "PAYMENT", priority: "INFO", expiresAt: new Date("2020-01-01") },
    ],
  });
}

describe("listNotificationsPage — filters, pagination, expiry", () => {
  it("filters by category, priority array, and unreadOnly; excludes expired by default", async () => {
    const f = await makeNotificationsSchool("list-filters");
    await seed(f.school.id, f.admin.id);

    const all = await listNotificationsPage(f.school.id, f.admin.id, {}, 1, 20);
    expect(all.total).toBe(3); // the expired PAYMENT_CONFIRMED row is excluded by default

    const byCategory = await listNotificationsPage(f.school.id, f.admin.id, { category: "ASSIGNMENT" }, 1, 20);
    expect(byCategory.total).toBe(1);

    const byPriorities = await listNotificationsPage(f.school.id, f.admin.id, { priority: ["CRITICAL", "HIGH"] }, 1, 20);
    expect(byPriorities.total).toBe(2);

    const unread = await listNotificationsPage(f.school.id, f.admin.id, { unreadOnly: true }, 1, 20);
    expect(unread.total).toBe(2); // FEES_OUTSTANDING was seeded already-read

    const includingExpired = await listNotificationsPage(f.school.id, f.admin.id, { includeExpired: true }, 1, 20);
    expect(includingExpired.total).toBe(4);
  });

  it("paginates correctly", async () => {
    const f = await makeNotificationsSchool("list-pagination");
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        schoolId: f.school.id,
        userId: f.admin.id,
        type: "MESSAGE" as const,
        title: `Message ${i}`,
        category: "MESSAGING" as const,
      })),
    });

    const page1 = await listNotificationsPage(f.school.id, f.admin.id, {}, 1, 20);
    expect(page1.items).toHaveLength(20);
    expect(page1.totalPages).toBe(2);

    const page2 = await listNotificationsPage(f.school.id, f.admin.id, {}, 2, 20);
    expect(page2.items).toHaveLength(5);
  });

  it("search matches title/body, case-insensitively", async () => {
    const f = await makeNotificationsSchool("list-search");
    await prisma.notification.create({
      data: { schoolId: f.school.id, userId: f.admin.id, type: "MESSAGE", title: "Mathematics results published", category: "RESULT" },
    });
    const found = await listNotificationsPage(f.school.id, f.admin.id, { search: "mathematics" }, 1, 20);
    expect(found.total).toBe(1);
    const notFound = await listNotificationsPage(f.school.id, f.admin.id, { search: "chemistry" }, 1, 20);
    expect(notFound.total).toBe(0);
  });
});

describe("read/delete/expiry actions — scoped to the correct user only", () => {
  it("markNotificationRead/markAllNotificationsRead/deleteNotification never touch another user's row", async () => {
    const f = await makeNotificationsSchool("scoping");
    const mine = await prisma.notification.create({
      data: { schoolId: f.school.id, userId: f.admin.id, type: "MESSAGE", title: "Mine", category: "MESSAGING" },
    });
    const theirs = await prisma.notification.create({
      data: { schoolId: f.school.id, userId: f.teacher.id, type: "MESSAGE", title: "Theirs", category: "MESSAGING" },
    });

    // The admin tries to mark/delete the teacher's notification by id — scoped queries must no-op.
    await markNotificationRead(f.school.id, f.admin.id, theirs.id);
    const theirsAfter = await prisma.notification.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(theirsAfter.readAt).toBeNull();

    await deleteNotification(f.school.id, f.admin.id, theirs.id);
    const stillExists = await prisma.notification.findUnique({ where: { id: theirs.id } });
    expect(stillExists).not.toBeNull();

    await markNotificationRead(f.school.id, f.admin.id, mine.id);
    const mineAfter = await prisma.notification.findUniqueOrThrow({ where: { id: mine.id } });
    expect(mineAfter.readAt).not.toBeNull();

    expect(await unreadNotificationCount(f.school.id, f.teacher.id)).toBe(1);
    await markAllNotificationsRead(f.school.id, f.teacher.id);
    expect(await unreadNotificationCount(f.school.id, f.teacher.id)).toBe(0);
  });

  it("hasExpiredNotifications/clearExpiredNotifications are scoped per user and actually remove expired rows", async () => {
    const f = await makeNotificationsSchool("expiry");
    await prisma.notification.create({
      data: { schoolId: f.school.id, userId: f.admin.id, type: "MESSAGE", title: "Expired", category: "MESSAGING", expiresAt: new Date("2020-01-01") },
    });
    expect(await hasExpiredNotifications(f.school.id, f.admin.id)).toBe(true);
    expect(await hasExpiredNotifications(f.school.id, f.teacher.id)).toBe(false);

    await clearExpiredNotifications(f.school.id, f.admin.id);
    expect(await hasExpiredNotifications(f.school.id, f.admin.id)).toBe(false);
  });
});

describe("notification preferences", () => {
  it("defaults every toggleable category to true, and SYSTEM is never offered as toggleable", async () => {
    const f = await makeNotificationsSchool("prefs-default");
    const prefs = await getNotificationPreferences(f.school.id, f.admin.id);
    for (const category of PREFERENCE_TOGGLEABLE_CATEGORIES) expect(prefs[category]).toBe(true);
    expect(PREFERENCE_TOGGLEABLE_CATEGORIES).not.toContain("SYSTEM");
  });

  it("persists a change and reflects it back", async () => {
    const f = await makeNotificationsSchool("prefs-set");
    await setNotificationPreference(f.school.id, f.admin.id, "FEES", false);
    const prefs = await getNotificationPreferences(f.school.id, f.admin.id);
    expect(prefs.FEES).toBe(false);
    expect(prefs.ASSIGNMENT).toBe(true); // untouched categories stay at their default

    // Flipping back on works too (upsert, not insert-only).
    await setNotificationPreference(f.school.id, f.admin.id, "FEES", true);
    const prefsAfter = await getNotificationPreferences(f.school.id, f.admin.id);
    expect(prefsAfter.FEES).toBe(true);
  });

  it("silently ignores a non-suppressible category (SYSTEM) rather than creating a useless row", async () => {
    const f = await makeNotificationsSchool("prefs-system");
    await setNotificationPreference(f.school.id, f.admin.id, "SYSTEM", false);
    const row = await prisma.notificationPreference.findFirst({ where: { schoolId: f.school.id, userId: f.admin.id, category: "SYSTEM" } });
    expect(row).toBeNull();
  });
});
