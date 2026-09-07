import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/auth/permissions";

const SUFFIX = `authz-${Date.now()}`;

describe("effective permission resolution (role + per-user overrides)", () => {
  let staffUserId: string;
  let permissionId: string;

  beforeAll(async () => {
    const staffRole = await prisma.role.upsert({ where: { key: "STAFF" }, update: {}, create: { key: "STAFF", name: "Staff" } });

    const permission = await prisma.permission.upsert({
      where: { key: PERMISSIONS.STAFF_MANAGE },
      update: {},
      create: { key: PERMISSIONS.STAFF_MANAGE, description: "Manage staff", category: "Administration" },
    });
    permissionId = permission.id;

    // Ensure STAFF does NOT have staff.manage by default (matches the seeded role scope).
    await prisma.rolePermission.deleteMany({ where: { roleId: staffRole.id, permissionId } });

    const user = await prisma.user.create({
      data: { name: "Test Staff", email: `staff-${SUFFIX}@example.com`, roleId: staffRole.id, status: "ACTIVE" },
    });
    staffUserId = user.id;
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before staffUserId was assigned --
    // an unscoped `where: { userId: undefined }` matches every row in the
    // table, so without this a setup failure would wipe unrelated data.
    if (!staffUserId) return;

    await prisma.userPermission.deleteMany({ where: { userId: staffUserId } });
    await prisma.user.delete({ where: { id: staffUserId } });
  });

  it("a STAFF user does not have staff.manage by default", async () => {
    const permissions = await getUserPermissions(staffUserId);
    expect(permissions.has(PERMISSIONS.STAFF_MANAGE)).toBe(false);
  });

  it("granting a per-user override adds the permission without changing the role", async () => {
    await prisma.userPermission.create({ data: { userId: staffUserId, permissionId, granted: true } });
    const permissions = await getUserPermissions(staffUserId);
    expect(permissions.has(PERMISSIONS.STAFF_MANAGE)).toBe(true);
  });

  it("revoking the override removes the permission again", async () => {
    await prisma.userPermission.update({
      where: { userId_permissionId: { userId: staffUserId, permissionId } },
      data: { granted: false },
    });
    const permissions = await getUserPermissions(staffUserId);
    expect(permissions.has(PERMISSIONS.STAFF_MANAGE)).toBe(false);
  });
});
