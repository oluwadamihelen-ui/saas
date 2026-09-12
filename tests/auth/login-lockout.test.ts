import { describe, it, expect, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkPasswordWithLockout, MAX_FAILED_ATTEMPTS } from "@/lib/auth/login-lockout";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

async function makeUser() {
  const slug = `vitest-lockout-${Date.now()}-${Math.random()}`;
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "SCHOOL_OWNER", name: "Owner" } });
  const passwordHash = await bcrypt.hash("correct-horse-battery-staple", 10);
  const user = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}@vitest.local`, passwordHash, name: "Owner", status: "ACTIVE" },
  });
  return { school, user };
}

describe("checkPasswordWithLockout", () => {
  it("accepts the correct password and leaves failedLoginCount at 0", async () => {
    const { user } = await makeUser();
    const ok = await checkPasswordWithLockout(user, "correct-horse-battery-staple");
    expect(ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
  });

  it("rejects a wrong password and increments failedLoginCount", async () => {
    const { user } = await makeUser();
    const ok = await checkPasswordWithLockout(user, "wrong-password");
    expect(ok).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(1);
    expect(after.lockedUntil).toBeNull();
  });

  it("locks the account after MAX_FAILED_ATTEMPTS wrong passwords", async () => {
    const { user } = await makeUser();
    let latest = user;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await checkPasswordWithLockout(latest, "wrong-password");
      latest = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    }
    expect(latest.lockedUntil).not.toBeNull();
    expect(latest.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(latest.failedLoginCount).toBe(0); // counter resets once locked
  });

  it("rejects even the CORRECT password while locked, without touching bcrypt", async () => {
    const { user } = await makeUser();
    const locked = { ...user, lockedUntil: new Date(Date.now() + 60_000) };
    const ok = await checkPasswordWithLockout(locked, "correct-horse-battery-staple");
    expect(ok).toBe(false);
  });

  it("a successful login after a past (expired) lock clears both counters", async () => {
    const { user } = await makeUser();
    const expiredLock = { ...user, failedLoginCount: 3, lockedUntil: new Date(Date.now() - 60_000) };
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 3, lockedUntil: expiredLock.lockedUntil } });

    const ok = await checkPasswordWithLockout(expiredLock, "correct-horse-battery-staple");
    expect(ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
  });
});
