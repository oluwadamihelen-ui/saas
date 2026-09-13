import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createSchoolWithOwner } from "@/lib/school-provisioning";
import { listRolesForSchool, updateRolePermissions, RolePermissionUpdateError } from "@/lib/services/role-permissions";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool() {
  counter += 1;
  const schoolName = `vitest-roleperm-${Date.now()}-${counter}`;
  const { owner } = await createSchoolWithOwner({
    schoolName,
    ownerName: "Test Owner",
    ownerEmail: `owner-${schoolName}@example.com`,
    password: "Passw0rd!23",
  });
  const school = await prisma.school.findUniqueOrThrow({ where: { slug: schoolName } });
  const roles = await prisma.role.findMany({ where: { schoolId: school.id } });
  const roleByKey = new Map(roles.map((r) => [r.key, r]));
  return { school, roleByKey, ownerUserId: owner.id };
}

describe("Role permission defaults", () => {
  it("TEACHER does not get SCHOOL_SETTINGS_MANAGE by default", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.TEACHER).not.toContain(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);
  });

  it("both SCHOOL_OWNER and PRINCIPAL (Head of School) can manage role permissions by default", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.SCHOOL_OWNER).toContain(PERMISSIONS.ROLES_MANAGE);
    expect(ROLE_DEFAULT_PERMISSIONS.PRINCIPAL).toContain(PERMISSIONS.ROLES_MANAGE);
  });

  it("a freshly provisioned school's TEACHER role really doesn't have SCHOOL_SETTINGS_MANAGE", async () => {
    const { school } = await makeSchool();
    const roles = await listRolesForSchool(school.id);
    const teacher = roles.find((r) => r.key === "TEACHER")!;
    expect(teacher.permissionKeys).not.toContain(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);
  });
});

describe("updateRolePermissions", () => {
  it("lets an authorized owner grant a role a permission it didn't have, and revoke it again", async () => {
    const { school, roleByKey, ownerUserId } = await makeSchool();
    const owner = roleByKey.get("SCHOOL_OWNER")!;
    const teacher = roleByKey.get("TEACHER")!;

    const before = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    expect(before.permissionKeys).not.toContain(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

    await updateRolePermissions(school.id, ownerUserId, owner.id, teacher.id, [
      ...before.permissionKeys,
      PERMISSIONS.SCHOOL_SETTINGS_MANAGE,
    ] as never);

    const afterGrant = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    expect(afterGrant.permissionKeys).toContain(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

    await updateRolePermissions(school.id, ownerUserId, owner.id, teacher.id, before.permissionKeys as never);
    const afterRevoke = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    expect(afterRevoke.permissionKeys).not.toContain(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);
  });

  it("never lets the SCHOOL_OWNER role's own permissions be changed", async () => {
    const { school, roleByKey } = await makeSchool();
    const owner = roleByKey.get("SCHOOL_OWNER")!;

    await expect(updateRolePermissions(school.id, "x", owner.id, owner.id, [] as never)).rejects.toThrow(
      RolePermissionUpdateError
    );

    const stillFull = (await listRolesForSchool(school.id)).find((r) => r.id === owner.id)!;
    expect(stillFull.permissionKeys.length).toBeGreaterThan(0);
  });

  it("blocks a role from removing ROLES_MANAGE from itself, but allows removing it from a different role", async () => {
    const { school, roleByKey, ownerUserId } = await makeSchool();
    const principal = roleByKey.get("PRINCIPAL")!;
    const teacher = roleByKey.get("TEACHER")!;

    const principalBefore = (await listRolesForSchool(school.id)).find((r) => r.id === principal.id)!;
    const withoutRolesManage = principalBefore.permissionKeys.filter((k) => k !== PERMISSIONS.ROLES_MANAGE);

    // Acting as the Principal, editing the Principal's own role.
    await expect(
      updateRolePermissions(school.id, ownerUserId, principal.id, principal.id, withoutRolesManage as never)
    ).rejects.toThrow("You can't remove your own ability to manage roles.");

    // Granting ROLES_MANAGE to a different role (Teacher) is unrestricted.
    const teacherBefore = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    await updateRolePermissions(school.id, ownerUserId, principal.id, teacher.id, [
      ...teacherBefore.permissionKeys,
      PERMISSIONS.ROLES_MANAGE,
    ] as never);
    const teacherAfter = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    expect(teacherAfter.permissionKeys).toContain(PERMISSIONS.ROLES_MANAGE);
  });

  it("never touches another school's role, even if its id is passed directly", async () => {
    const { school: schoolA } = await makeSchool();
    const { roleByKey: rolesB } = await makeSchool();
    const teacherB = rolesB.get("TEACHER")!;

    await expect(
      updateRolePermissions(schoolA.id, "x", "irrelevant", teacherB.id, [PERMISSIONS.SCHOOL_SETTINGS_MANAGE] as never)
    ).rejects.toThrow("Role not found.");

    const teacherBUnchanged = await prisma.role.findUnique({
      where: { id: teacherB.id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    expect(teacherBUnchanged?.rolePermissions.some((rp) => rp.permission.key === PERMISSIONS.SCHOOL_SETTINGS_MANAGE)).toBe(false);
  });

  it("silently ignores an unrecognized permission key instead of throwing", async () => {
    const { school, roleByKey, ownerUserId } = await makeSchool();
    const teacher = roleByKey.get("TEACHER")!;
    const before = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;

    await updateRolePermissions(school.id, ownerUserId, roleByKey.get("SCHOOL_OWNER")!.id, teacher.id, [
      ...before.permissionKeys,
      "not.a.real.permission",
    ] as never);

    const after = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    expect(after.permissionKeys).toEqual(before.permissionKeys);
  });

  it("logs an audit entry only when the permission set actually changes", async () => {
    const { school, roleByKey, ownerUserId } = await makeSchool();
    const owner = roleByKey.get("SCHOOL_OWNER")!;
    const teacher = roleByKey.get("TEACHER")!;
    const before = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;

    await updateRolePermissions(school.id, ownerUserId, owner.id, teacher.id, [
      ...before.permissionKeys,
      PERMISSIONS.SCHOOL_SETTINGS_MANAGE,
    ] as never);

    const logsAfterChange = await prisma.auditLog.findMany({ where: { schoolId: school.id, action: "roles.permissions_changed" } });
    expect(logsAfterChange).toHaveLength(1);
    expect((logsAfterChange[0].newValue as { permissions: string[] }).permissions).toContain(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

    // Submitting the exact same set again is a no-op — no second log entry.
    const unchanged = (await listRolesForSchool(school.id)).find((r) => r.id === teacher.id)!;
    await updateRolePermissions(school.id, ownerUserId, owner.id, teacher.id, unchanged.permissionKeys as never);
    const logsAfterNoop = await prisma.auditLog.findMany({ where: { schoolId: school.id, action: "roles.permissions_changed" } });
    expect(logsAfterNoop).toHaveLength(1);
  });
});
