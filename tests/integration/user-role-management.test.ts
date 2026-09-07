import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { promoteToDeveloper, revertToCustomer, suspendPlatformUser, reactivatePlatformUser } from "@/lib/services/users";

const SUFFIX = `user-role-${Date.now()}`;

describe("users service: role promotion/demotion and status control", () => {
  let adminId: string;
  let customerId: string;
  let staffId: string;

  beforeAll(async () => {
    const [adminRole, customerRole, staffRole] = await Promise.all([
      prisma.role.upsert({ where: { key: "SUPER_ADMIN" }, update: {}, create: { key: "SUPER_ADMIN", name: "Super Admin" } }),
      prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } }),
      prisma.role.upsert({ where: { key: "STAFF" }, update: {}, create: { key: "STAFF", name: "Staff" } }),
    ]);
    await prisma.role.upsert({ where: { key: "DEVELOPER" }, update: {}, create: { key: "DEVELOPER", name: "Developer" } });

    const admin = await prisma.user.create({
      data: { name: "Test Admin", email: `admin-${SUFFIX}@example.com`, roleId: adminRole.id, status: "ACTIVE" },
    });
    adminId = admin.id;

    const customer = await prisma.user.create({
      data: { name: "Test Buyer", email: `buyer-${SUFFIX}@example.com`, roleId: customerRole.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const staff = await prisma.user.create({
      data: { name: "Test Staff", email: `staff-${SUFFIX}@example.com`, roleId: staffRole.id, status: "ACTIVE" },
    });
    staffId = staff.id;
  });

  afterAll(async () => {
    if (!adminId || !customerId || !staffId) return;
    await prisma.user.deleteMany({ where: { id: { in: [adminId, customerId, staffId] } } });
  });

  it("promotes a buyer to developer", async () => {
    const updated = await promoteToDeveloper(adminId, customerId);
    expect(updated.roleId).not.toBeNull();

    const withRole = await prisma.user.findUniqueOrThrow({ where: { id: customerId }, include: { role: true } });
    expect(withRole.role.key).toBe("DEVELOPER");
  });

  it("is idempotent when promoting an already-developer user", async () => {
    await expect(promoteToDeveloper(adminId, customerId)).resolves.toBeTruthy();
    const withRole = await prisma.user.findUniqueOrThrow({ where: { id: customerId }, include: { role: true } });
    expect(withRole.role.key).toBe("DEVELOPER");
  });

  it("reverts a developer back to buyer", async () => {
    await revertToCustomer(adminId, customerId);
    const withRole = await prisma.user.findUniqueOrThrow({ where: { id: customerId }, include: { role: true } });
    expect(withRole.role.key).toBe("CUSTOMER");
  });

  it("suspends and reactivates a platform user", async () => {
    await suspendPlatformUser(adminId, customerId);
    let user = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.status).toBe("SUSPENDED");

    await reactivatePlatformUser(adminId, customerId);
    user = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.status).toBe("ACTIVE");
  });

  it("refuses to promote/suspend a staff or admin account", async () => {
    await expect(promoteToDeveloper(adminId, staffId)).rejects.toThrow(/Staff and admin accounts/);
    await expect(suspendPlatformUser(adminId, staffId)).rejects.toThrow(/Staff and admin accounts/);
  });

  it("records an audit log entry for a role change", async () => {
    await promoteToDeveloper(adminId, customerId);
    const entry = await prisma.auditLog.findFirst({
      where: { actorId: adminId, resourceId: customerId, action: "user.promoted_to_developer" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).not.toBeNull();
  });
}, 30000);
