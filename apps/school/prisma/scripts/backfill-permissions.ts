import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS, SYSTEM_ROLE_KEYS } from "../../src/lib/permissions";

// Standalone script (not imported from src/lib/school-provisioning.ts, which
// has `import "server-only"` and throws outside Next's server bundle — same
// constraint prisma/seed/index.ts already works around) that syncs every
// existing school's system roles to today's ROLE_DEFAULT_PERMISSIONS:
// granting anything missing, and revoking anything a role's defaults no
// longer include.
//
// ROLE_DEFAULT_PERMISSIONS is only ever applied once, at school-creation
// time. Two things have happened since Phase 1: a later phase adding a new
// default permission to an existing role (Phase 2 added attendance/
// timetable, Phase 4 added announcements/messages, Phase 5 added
// assistant.use, ...), and a later phase deliberately narrowing one (e.g.
// restricting students.create to just SCHOOL_OWNER/PRINCIPAL). Neither
// retroactively applies to a school that already existed — the first
// leaves a role short a permission it should have (a "Missing permission"
// error on a page that role should now reach); the second leaves a role
// holding a permission it shouldn't have anymore. Syncing in both
// directions is safe only because there's no role-editing UI yet
// (ARCHITECTURE.md) — there's no intentional per-school customization this
// could ever clobber.
//
// Run with: npm run db:backfill-permissions

const prisma = new PrismaClient();

async function main() {
  console.log("Syncing role permissions to current defaults...");

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
  const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const roles = await prisma.role.findMany({
    where: { isSystem: true, key: { in: [...SYSTEM_ROLE_KEYS] } },
    include: { rolePermissions: true, school: true },
  });

  const toGrant: { roleId: string; permissionId: string; schoolName: string; roleKey: string }[] = [];
  const toRevoke: { roleId: string; permissionId: string; schoolName: string; roleKey: string }[] = [];

  for (const role of roles) {
    const key = role.key as (typeof SYSTEM_ROLE_KEYS)[number];
    const schoolName = role.school?.name ?? "?";
    const defaultIds = new Set(
      (ROLE_DEFAULT_PERMISSIONS[key] ?? []).map((permKey) => permissionByKey.get(permKey)).filter((id): id is string => id !== undefined)
    );
    const currentIds = new Set(role.rolePermissions.map((rp) => rp.permissionId));

    for (const id of defaultIds) {
      if (!currentIds.has(id)) toGrant.push({ roleId: role.id, permissionId: id, schoolName, roleKey: key });
    }
    for (const id of currentIds) {
      if (!defaultIds.has(id)) toRevoke.push({ roleId: role.id, permissionId: id, schoolName, roleKey: key });
    }
  }

  if (toGrant.length > 0) {
    await prisma.rolePermission.createMany({
      data: toGrant.map(({ roleId, permissionId }) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }
  for (const r of toRevoke) {
    await prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId: r.roleId, permissionId: r.permissionId } } });
  }

  const summarize = (changes: { schoolName: string; roleKey: string }[]) => {
    const bySchool = new Map<string, Set<string>>();
    for (const c of changes) {
      if (!bySchool.has(c.schoolName)) bySchool.set(c.schoolName, new Set());
      bySchool.get(c.schoolName)!.add(c.roleKey);
    }
    return bySchool;
  };

  for (const [school, roleKeys] of summarize(toGrant)) {
    console.log(`  ${school}: granted new permissions to ${[...roleKeys].join(", ")}`);
  }
  for (const [school, roleKeys] of summarize(toRevoke)) {
    console.log(`  ${school}: revoked outdated permissions from ${[...roleKeys].join(", ")}`);
  }

  console.log(
    `\nChecked ${roles.length} role(s) across all schools — granted ${toGrant.length}, revoked ${toRevoke.length}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
