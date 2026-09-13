import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PERMISSION_CATALOG } from "../../src/lib/permissions";

// Standalone script (see backfill-permissions.ts for why this can't just
// import from src/lib/school-provisioning.ts) that grants every school's
// SCHOOL_OWNER role any permission in today's PERMISSION_CATALOG it
// doesn't already hold.
//
// ROLE_DEFAULT_PERMISSIONS is only ever applied once, at school-creation
// time (createSchoolWithOwner). Every permission added to the catalog
// since a given school signed up — notification_providers.manage
// (provider-agnostic email/SMS delivery), and anything added after
// whichever backfill-permissions run last covered that school — never
// retroactively lands on that school's existing roles. For every OTHER
// system role that's a real problem (a school may have deliberately
// narrowed or widened that role via Manage Roles since), which is why
// backfill-permissions.ts must never run again as a blanket resync.
//
// SCHOOL_OWNER is different: it is hard-locked everywhere in the app —
// updateRolePermissions() refuses to edit it, and the Manage Roles UI
// marks it isLocked and won't render controls for it — specifically
// because it must always hold every permission there is, with zero
// exceptions and zero legitimate per-school customization to protect.
// So granting it whatever it's missing is safe by construction, never
// revokes anything, and never touches any other role.
//
// Run with: npm run db:backfill-owner-permissions

const prisma = new PrismaClient();

async function main() {
  console.log("Granting every school's Owner role any missing permission...");

  await Promise.all(
    PERMISSION_CATALOG.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, module: p.module, action: p.key.split(".")[1] ?? p.key, description: p.description },
        update: { module: p.module, description: p.description },
      })
    )
  );
  const permissions = await prisma.permission.findMany();
  const allPermissionIds = permissions.map((p) => p.id);

  const ownerRoles = await prisma.role.findMany({
    where: { key: "SCHOOL_OWNER" },
    include: { rolePermissions: true, school: true },
  });

  const toGrant: { roleId: string; permissionId: string; schoolName: string }[] = [];
  for (const role of ownerRoles) {
    const currentIds = new Set(role.rolePermissions.map((rp) => rp.permissionId));
    for (const permissionId of allPermissionIds) {
      if (!currentIds.has(permissionId)) {
        toGrant.push({ roleId: role.id, permissionId, schoolName: role.school?.name ?? "?" });
      }
    }
  }

  if (toGrant.length > 0) {
    await prisma.rolePermission.createMany({
      data: toGrant.map(({ roleId, permissionId }) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }

  const bySchool = new Map<string, number>();
  for (const g of toGrant) bySchool.set(g.schoolName, (bySchool.get(g.schoolName) ?? 0) + 1);
  for (const [school, count] of bySchool) {
    console.log(`  ${school}: granted ${count} missing permission(s) to Owner`);
  }

  console.log(`\nChecked ${ownerRoles.length} Owner role(s) across all schools — granted ${toGrant.length} missing permission(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
