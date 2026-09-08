import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { SUPER_ADMIN_ROLE_KEY } from "../../src/lib/permissions";

// Standalone script (see backfill-permissions.ts for why: server-only
// files can't be imported here) that creates the platform Super Admin
// account. There is deliberately no self-serve "become a Super Admin" UI
// — this is the one way to create that account, run once per environment.
//
// Run with: npm run platform:create-admin -- --email=you@winfield.demo --password=... --name="Your Name"

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const email = readArg("email")?.toLowerCase().trim();
  const password = readArg("password");
  const name = readArg("name") ?? "Platform Admin";

  if (!email || !password) {
    console.error('Usage: npm run platform:create-admin -- --email=you@example.com --password=... --name="Your Name"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.error(`${email} already has an account (role: ${(await prisma.role.findUnique({ where: { id: existingUser.roleId } }))?.key}).`);
    process.exit(1);
  }

  let role = await prisma.role.findFirst({ where: { schoolId: null, key: SUPER_ADMIN_ROLE_KEY } });
  if (!role) {
    role = await prisma.role.create({
      data: { schoolId: null, key: SUPER_ADMIN_ROLE_KEY, name: "Super Admin", isSystem: true },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { schoolId: null, roleId: role.id, email, name, passwordHash },
  });

  console.log(`Created Super Admin: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
