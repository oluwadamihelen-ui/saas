import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

/**
 * One-off operator tool: grant Super Admin to a real email address, on
 * whatever database DATABASE_URL points at (local dev, or a real
 * production database once you're running this on your own server).
 * Distinct from seedBootstrapAdmin() in prisma/seed/index.ts, which only
 * ever creates ONE admin at first-seed time from SEED_ADMIN_EMAIL/
 * SEED_ADMIN_PASSWORD -- this promotes/creates on demand, any time, for
 * any account, without touching the rest of the seed pipeline.
 *
 * Usage:
 *   npx tsx scripts/make-super-admin.ts you@example.com
 *   npx tsx scripts/make-super-admin.ts you@example.com "a-real-password"
 *
 * If the email already has an account, its role is switched to
 * SUPER_ADMIN (and its status to ACTIVE) -- the password argument is
 * ignored in that case, since there's no reason to touch a password the
 * person already has. If the email has no account yet, the password is
 * required to create one.
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email) {
    console.error("Usage: npx tsx scripts/make-super-admin.ts <email> [password]");
    process.exit(1);
  }

  const superAdminRole = await prisma.role.findUnique({ where: { key: "SUPER_ADMIN" } });
  if (!superAdminRole) {
    console.error('No SUPER_ADMIN role found -- run `npm run db:seed` first to create core roles/permissions.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.roleId === superAdminRole.id && existing.status === "ACTIVE") {
      console.log(`${email} is already an active Super Admin -- nothing to do.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { roleId: superAdminRole.id, status: "ACTIVE" },
    });
    console.log(`Promoted existing account ${email} to Super Admin.`);
    return;
  }

  if (!password) {
    console.error(`No account exists for ${email} yet -- pass a password to create one:\n  npx tsx scripts/make-super-admin.ts ${email} "a-real-password"`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name: "Admin", email, passwordHash, roleId: superAdminRole.id, status: "ACTIVE" },
  });
  console.log(`Created new Super Admin account: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
