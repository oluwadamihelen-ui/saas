import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  createStaffDirect,
  inviteStaffMember,
  acceptInvite,
  convertInviteToDirect,
  regeneratePasswordSetupLink,
  checkStaffDuplicate,
  listAssignableRoles,
} from "@/lib/services/staff";
import { changeUserRole, setUserStatus } from "@/lib/services/administration-users";
import { validateStaffImportRows, commitStaffImport } from "@/lib/services/staff-import";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
async function makeSchool() {
  counter += 1;
  const slug = `vitest-usermgmt-${Date.now()}-${counter}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const roleDefs = [
    { key: "SCHOOL_OWNER", name: "School Owner" },
    { key: "SCHOOL_ADMIN", name: "School Administrator" },
    { key: "TEACHER", name: "Teacher" },
    { key: "ACCOUNTANT", name: "Accountant / Bursar" },
    { key: "PARENT", name: "Parent" },
    { key: "STUDENT", name: "Student" },
  ];
  const roles = Object.fromEntries(
    await Promise.all(roleDefs.map(async (r) => [r.key, await prisma.role.create({ data: { schoolId: school.id, ...r } })]))
  ) as Record<string, { id: string; key: string; name: string }>;

  const owner = await prisma.user.create({
    data: {
      schoolId: school.id,
      roleId: roles.SCHOOL_OWNER.id,
      email: `owner-${Date.now()}-${counter}@vitest.local`,
      passwordHash: "x",
      name: "Owner",
      status: "ACTIVE",
    },
  });

  return { school, roles, owner };
}

describe("createStaffDirect", () => {
  it("creates the user immediately with status INVITED, correct school and role, and a password-setup link", async () => {
    const { school, roles, owner } = await makeSchool();

    const { user, invite } = await createStaffDirect(school.id, owner.id, {
      name: "John Ade",
      email: `john.ade.${Date.now()}@vitest.local`,
      roleId: roles.TEACHER.id,
      staffId: "STAFF-001",
    });

    expect(user.schoolId).toBe(school.id);
    expect(user.roleId).toBe(roles.TEACHER.id);
    expect(user.status).toBe("INVITED");
    expect(user.staffId).toBe("STAFF-001");

    expect(invite.purpose).toBe("PASSWORD_SETUP");
    expect(invite.userId).toBe(user.id);
    expect(invite.status).toBe("PENDING");

    // Can't authenticate yet — status isn't ACTIVE (see auth.ts authorize()).
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.status).not.toBe("ACTIVE");

    // Completing password setup activates the account.
    const activated = await acceptInvite(invite.token, { password: "correct horse battery staple" });
    expect(activated.id).toBe(user.id);
    expect(activated.status).toBe("ACTIVE");

    const final = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(final.status).toBe("ACTIVE");
    expect(await prisma.staffInvite.findUniqueOrThrow({ where: { id: invite.id } }).then((i) => i.status)).toBe("ACCEPTED");
  });

  it("rejects School Owner as an assignable role", async () => {
    const { school, roles, owner } = await makeSchool();
    await expect(
      createStaffDirect(school.id, owner.id, { name: "Wannabe Owner", email: `wannabe.${Date.now()}@vitest.local`, roleId: roles.SCHOOL_OWNER.id })
    ).rejects.toThrow(/owner/i);
  });

  it("rejects a duplicate email", async () => {
    const { school, roles, owner } = await makeSchool();
    const email = `dup.${Date.now()}@vitest.local`;
    await createStaffDirect(school.id, owner.id, { name: "First", email, roleId: roles.TEACHER.id });
    await expect(createStaffDirect(school.id, owner.id, { name: "Second", email, roleId: roles.TEACHER.id })).rejects.toThrow(/already has an account/i);
  });
});

describe("Staff ID uniqueness", () => {
  it("rejects a duplicate staffId within the same school, but allows the same staffId in a different school", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();

    await createStaffDirect(schoolA.school.id, schoolA.owner.id, {
      name: "A One",
      email: `a1.${Date.now()}@vitest.local`,
      roleId: schoolA.roles.TEACHER.id,
      staffId: "STAFF-001",
    });

    await expect(
      createStaffDirect(schoolA.school.id, schoolA.owner.id, {
        name: "A Two",
        email: `a2.${Date.now()}@vitest.local`,
        roleId: schoolA.roles.TEACHER.id,
        staffId: "STAFF-001",
      })
    ).rejects.toThrow(/already in use/i);

    // Same staffId, different school — allowed.
    const { user } = await createStaffDirect(schoolB.school.id, schoolB.owner.id, {
      name: "B One",
      email: `b1.${Date.now()}@vitest.local`,
      roleId: schoolB.roles.TEACHER.id,
      staffId: "STAFF-001",
    });
    expect(user.staffId).toBe("STAFF-001");
  });

  it("allows any number of staff with no staffId at all in the same school", async () => {
    const { school, roles, owner } = await makeSchool();
    const u1 = await createStaffDirect(school.id, owner.id, { name: "No Id One", email: `noid1.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });
    const u2 = await createStaffDirect(school.id, owner.id, { name: "No Id Two", email: `noid2.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });
    expect(u1.user.staffId).toBeNull();
    expect(u2.user.staffId).toBeNull();
  });
});

describe("password setup token security", () => {
  it("rejects an expired token", async () => {
    const { school, roles, owner } = await makeSchool();
    const { invite } = await createStaffDirect(school.id, owner.id, { name: "Expiry Test", email: `expiry.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });
    await prisma.staffInvite.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(acceptInvite(invite.token, { password: "aaaaaaaaaaaaa" })).rejects.toThrow(/expired/i);
  });

  it("rejects a token that was already used", async () => {
    const { school, roles, owner } = await makeSchool();
    const { invite } = await createStaffDirect(school.id, owner.id, { name: "Reuse Test", email: `reuse.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });
    await acceptInvite(invite.token, { password: "first-password-123" });
    await expect(acceptInvite(invite.token, { password: "second-password-456" })).rejects.toThrow(/no longer valid/i);
  });

  it("regenerating a password-setup link invalidates the old token immediately", async () => {
    const { school, roles, owner } = await makeSchool();
    const { user, invite: firstInvite } = await createStaffDirect(school.id, owner.id, {
      name: "Regen Test",
      email: `regen.${Date.now()}@vitest.local`,
      roleId: roles.TEACHER.id,
    });
    const oldToken = firstInvite.token;

    const secondInvite = await regeneratePasswordSetupLink(school.id, owner.id, user.id);
    expect(secondInvite.token).not.toBe(oldToken);
    expect(secondInvite.id).toBe(firstInvite.id); // same row, reused — not a second invite

    // The old token no longer resolves to anything at all.
    const lookupOld = await prisma.staffInvite.findUnique({ where: { token: oldToken } });
    expect(lookupOld).toBeNull();
    await expect(acceptInvite(oldToken, { password: "irrelevant-1234" })).rejects.toThrow();

    // The new token works.
    const activated = await acceptInvite(secondInvite.token, { password: "new-password-789" });
    expect(activated.status).toBe("ACTIVE");
  });
});

describe("existing invite flow (ACCOUNT_INVITATION) stays backward compatible", () => {
  it("creates a brand new user on accept, exactly as before", async () => {
    const { school, roles, owner } = await makeSchool();
    const email = `invite.${Date.now()}@vitest.local`;
    const invite = await inviteStaffMember(school.id, owner.id, email, roles.TEACHER.id);
    expect(invite.purpose).toBe("ACCOUNT_INVITATION");
    expect(invite.userId).toBeNull();

    const beforeCount = await prisma.user.count({ where: { schoolId: school.id } });
    const created = await acceptInvite(invite.token, { name: "Fresh Person", password: "a-real-password-1" });
    const afterCount = await prisma.user.count({ where: { schoolId: school.id } });

    expect(afterCount).toBe(beforeCount + 1);
    expect(created.name).toBe("Fresh Person");
    expect(created.status).toBe("ACTIVE");
    expect(created.schoolId).toBe(school.id);
  });
});

describe("convertInviteToDirect — pending invite conversion", () => {
  it("does not create a duplicate user, and converts the same invite row rather than leaving two", async () => {
    const { school, roles, owner } = await makeSchool();
    const email = `convert.${Date.now()}@vitest.local`;
    const invite = await inviteStaffMember(school.id, owner.id, email, roles.TEACHER.id);

    const { user, invite: newInvite } = await convertInviteToDirect(school.id, owner.id, invite.id, { name: "Converted Person" });

    expect(user.email).toBe(email);
    expect(user.status).toBe("INVITED");
    expect(newInvite.id).toBe(invite.id); // same row, purpose flipped in place
    expect(newInvite.purpose).toBe("PASSWORD_SETUP");
    expect(newInvite.userId).toBe(user.id);

    const usersWithEmail = await prisma.user.findMany({ where: { email } });
    expect(usersWithEmail).toHaveLength(1);

    const invitesForEmail = await prisma.staffInvite.findMany({ where: { schoolId: school.id, email } });
    expect(invitesForEmail).toHaveLength(1); // never a second row

    // The original ACCOUNT_INVITATION token no longer works — it's the
    // same row, now pointed at the new PASSWORD_SETUP purpose.
    const activated = await acceptInvite(newInvite.token, { password: "convert-password-1" });
    expect(activated.id).toBe(user.id);
    expect(activated.status).toBe("ACTIVE");
  });

  it("refuses to convert an invite that's already been accepted", async () => {
    const { school, roles, owner } = await makeSchool();
    const invite = await inviteStaffMember(school.id, owner.id, `accepted.${Date.now()}@vitest.local`, roles.TEACHER.id);
    await acceptInvite(invite.token, { name: "Already Here", password: "already-accepted-1" });
    await expect(convertInviteToDirect(school.id, owner.id, invite.id, { name: "Duplicate Attempt" })).rejects.toThrow();
  });
});

describe("role change security", () => {
  it("changes a staff member's role and logs the change", async () => {
    const { school, roles, owner } = await makeSchool();
    const { user } = await createStaffDirect(school.id, owner.id, { name: "Role Change Target", email: `rolechange.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });

    const updated = await changeUserRole(school.id, owner.id, user.id, roles.ACCOUNTANT.id);
    expect(updated.roleId).toBe(roles.ACCOUNTANT.id);

    const log = await prisma.auditLog.findFirst({ where: { schoolId: school.id, action: "staff.role_changed", resourceId: user.id }, orderBy: { createdAt: "desc" } });
    expect(log).not.toBeNull();
    expect((log!.newValue as { roleId: string }).roleId).toBe(roles.ACCOUNTANT.id);
  });

  it("SCHOOL_OWNER cannot be assigned to another user", async () => {
    const { school, roles, owner } = await makeSchool();
    const { user } = await createStaffDirect(school.id, owner.id, { name: "Wannabe Owner", email: `wannabeowner.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });
    await expect(changeUserRole(school.id, owner.id, user.id, roles.SCHOOL_OWNER.id)).rejects.toThrow(/owner/i);
  });

  it("SCHOOL_OWNER's own role cannot be changed away from Owner", async () => {
    const { school, roles, owner } = await makeSchool();
    await expect(changeUserRole(school.id, owner.id, owner.id, roles.TEACHER.id)).rejects.toThrow(/owner/i);
  });

  it("cannot change the role of a PARENT/STUDENT portal account", async () => {
    const { school, roles, owner } = await makeSchool();
    const parentUser = await prisma.user.create({
      data: { schoolId: school.id, roleId: roles.PARENT.id, email: `parent.${Date.now()}@vitest.local`, passwordHash: "x", name: "A Parent" },
    });
    await expect(changeUserRole(school.id, owner.id, parentUser.id, roles.TEACHER.id)).rejects.toThrow(/portal/i);
  });

  it("rejects a cross-school role change attempt", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();
    const { user } = await createStaffDirect(schoolB.school.id, schoolB.owner.id, {
      name: "School B Teacher",
      email: `schoolb.${Date.now()}@vitest.local`,
      roleId: schoolB.roles.TEACHER.id,
    });

    // School A's owner tries to change a School B user's role.
    await expect(changeUserRole(schoolA.school.id, schoolA.owner.id, user.id, schoolA.roles.ACCOUNTANT.id)).rejects.toThrow(/not found/i);

    // The user's role in School B is untouched.
    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(untouched.roleId).toBe(schoolB.roles.TEACHER.id);
  });

  it("rejects assigning a role that belongs to a different school", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();
    const { user } = await createStaffDirect(schoolA.school.id, schoolA.owner.id, {
      name: "School A Teacher",
      email: `schoola.${Date.now()}@vitest.local`,
      roleId: schoolA.roles.TEACHER.id,
    });
    await expect(changeUserRole(schoolA.school.id, schoolA.owner.id, user.id, schoolB.roles.ACCOUNTANT.id)).rejects.toThrow(/valid role/i);
  });
});

describe("suspend / reactivate", () => {
  it("suspends and reactivates a staff account, logging both", async () => {
    const { school, roles, owner } = await makeSchool();
    const { user } = await createStaffDirect(school.id, owner.id, { name: "Suspend Target", email: `suspend.${Date.now()}@vitest.local`, roleId: roles.TEACHER.id });
    await acceptInvite((await prisma.staffInvite.findFirstOrThrow({ where: { userId: user.id } })).token, { password: "suspend-me-1234" });

    const suspended = await setUserStatus(school.id, owner.id, user.id, "SUSPENDED");
    expect(suspended.status).toBe("SUSPENDED");

    const reactivated = await setUserStatus(school.id, owner.id, user.id, "ACTIVE");
    expect(reactivated.status).toBe("ACTIVE");

    const logs = await prisma.auditLog.findMany({ where: { schoolId: school.id, resourceId: user.id, action: { in: ["staff.suspended", "staff.reactivated"] } } });
    expect(logs.map((l) => l.action).sort()).toEqual(["staff.reactivated", "staff.suspended"]);
  });

  it("SCHOOL_OWNER cannot be suspended", async () => {
    const { school, owner } = await makeSchool();
    await expect(setUserStatus(school.id, owner.id, owner.id, "SUSPENDED")).rejects.toThrow(/owner/i);
  });
});

describe("multi-school isolation", () => {
  it("School A cannot create a staff member reusing School B's role id", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();
    await expect(
      createStaffDirect(schoolA.school.id, schoolA.owner.id, { name: "Cross School", email: `cross.${Date.now()}@vitest.local`, roleId: schoolB.roles.TEACHER.id })
    ).rejects.toThrow(/valid role/i);
  });

  it("checkStaffDuplicate for a school never returns another school's staffId as a conflict", async () => {
    const schoolA = await makeSchool();
    const schoolB = await makeSchool();
    await createStaffDirect(schoolB.school.id, schoolB.owner.id, {
      name: "B Staff",
      email: `bstaff.${Date.now()}@vitest.local`,
      roleId: schoolB.roles.TEACHER.id,
      staffId: "SHARED-001",
    });
    const dup = await checkStaffDuplicate(schoolA.school.id, `new.${Date.now()}@vitest.local`, "SHARED-001");
    expect(dup.staffIdConflict).toBeNull();
  });
});

describe("bulk registration validation and commit", () => {
  it("flags required fields, invalid role, and duplicate email/staffId within the same file", async () => {
    const { school } = await makeSchool();
    const email = `bulkdup.${Date.now()}@vitest.local`;
    const { rows } = await validateStaffImportRows(school.id, [
      { rowNumber: 1, raw: { name: "", email: "notanemail", role: "Teacher", staffid: "S1" } },
      { rowNumber: 2, raw: { name: "Valid Person", email, role: "NotARealRole", staffid: "S2" } },
      { rowNumber: 3, raw: { name: "Dup Email", email, role: "Teacher", staffid: "S3" } },
      { rowNumber: 4, raw: { name: "Dup Staff", email: `other.${Date.now()}@vitest.local`, role: "Teacher", staffid: "S1" } },
    ]);

    expect(rows[0].errors.some((e) => /invalid email/i.test(e))).toBe(true);
    expect(rows[1].errors.some((e) => /invalid role/i.test(e))).toBe(true);
    expect(rows[2].errors.some((e) => /duplicate email/i.test(e))).toBe(true);
    expect(rows[3].errors.some((e) => /duplicate staff id/i.test(e))).toBe(true);
    expect(rows.every((r) => r.data === null)).toBe(true);
  });

  it("valid rows pass, and against-DB duplicates are caught (existing user, existing staffId)", async () => {
    const { school, roles, owner } = await makeSchool();
    const existingEmail = `existing.${Date.now()}@vitest.local`;
    await createStaffDirect(school.id, owner.id, { name: "Existing", email: existingEmail, roleId: roles.TEACHER.id, staffId: "TAKEN-01" });

    const { rows } = await validateStaffImportRows(school.id, [
      { rowNumber: 1, raw: { name: "Brand New", email: `brandnew.${Date.now()}@vitest.local`, role: "Teacher" } },
      { rowNumber: 2, raw: { name: "Reuses Email", email: existingEmail, role: "Teacher" } },
      { rowNumber: 3, raw: { name: "Reuses Staff Id", email: `newstaffid.${Date.now()}@vitest.local`, role: "Teacher", staffid: "TAKEN-01" } },
    ]);

    expect(rows[0].data).not.toBeNull();
    expect(rows[1].errors.some((e) => /already has an account/i.test(e))).toBe(true);
    expect(rows[2].errors.some((e) => /already in use/i.test(e))).toBe(true);
  });

  it("commits valid rows in DIRECT mode, creating real accounts with password-setup links", async () => {
    const { school, owner } = await makeSchool();
    const { rows } = await validateStaffImportRows(school.id, [
      { rowNumber: 1, raw: { name: "Bulk One", email: `bulk1.${Date.now()}@vitest.local`, role: "Teacher" } },
      { rowNumber: 2, raw: { name: "Bulk Two", email: `bulk2.${Date.now()}@vitest.local`, role: "Accountant / Bursar" } },
    ]);
    const validRows = rows.filter((r) => r.data).map((r) => ({ rowNumber: r.rowNumber, data: r.data! }));
    expect(validRows).toHaveLength(2);

    const outcome = await commitStaffImport(school.id, owner.id, validRows, "DIRECT");
    expect(outcome.created).toBe(2);
    expect(outcome.failed).toHaveLength(0);
    expect(outcome.results).toHaveLength(2);
    for (const r of outcome.results) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: r.email } });
      expect(user.schoolId).toBe(school.id);
      expect(user.status).toBe("INVITED");
    }
  });

  it("commits valid rows in INVITE mode without creating any User rows", async () => {
    const { school, owner } = await makeSchool();
    const { rows } = await validateStaffImportRows(school.id, [
      { rowNumber: 1, raw: { name: "Invite Only", email: `inviteonly.${Date.now()}@vitest.local`, role: "Teacher" } },
    ]);
    const validRows = rows.filter((r) => r.data).map((r) => ({ rowNumber: r.rowNumber, data: r.data! }));

    const outcome = await commitStaffImport(school.id, owner.id, validRows, "INVITE");
    expect(outcome.created).toBe(1);
    const user = await prisma.user.findUnique({ where: { email: validRows[0].data.email } });
    expect(user).toBeNull(); // no User row yet — only an invite
    const invite = await prisma.staffInvite.findFirst({ where: { schoolId: school.id, email: validRows[0].data.email } });
    expect(invite?.purpose).toBe("ACCOUNT_INVITATION");
  });
});

describe("listAssignableRoles", () => {
  it("excludes SCHOOL_OWNER, PARENT and STUDENT", async () => {
    const { school } = await makeSchool();
    const roles = await listAssignableRoles(school.id);
    const keys = roles.map((r) => r.key);
    expect(keys).not.toContain("SCHOOL_OWNER");
    expect(keys).not.toContain("PARENT");
    expect(keys).not.toContain("STUDENT");
    expect(keys).toContain("TEACHER");
  });
});
