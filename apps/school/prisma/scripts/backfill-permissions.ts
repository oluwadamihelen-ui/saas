import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS, SYSTEM_ROLE_KEYS } from "../../src/lib/permissions";

// Standalone script (not imported from src/lib/school-provisioning.ts, which
// has `import "server-only"` and throws outside Next's server bundle — same
// constraint prisma/seed/index.ts already works around) that tops up every
// existing school's system roles with any default permission added to the
// catalog since that school was created.
//
// Every phase since Phase 1 has occasionally added a new default permission
// to an existing role (Phase 2 added attendance/timetable, Phase 4 added
// announcements/messages, Phase 5 added assistant.use, ...), but
// ROLE_DEFAULT_PERMISSIONS is only ever applied once, at school-creation
// time. A school provisioned before one of those additions never
// automatically gains it, so a role that should now see a page throws
// "Missing permission" instead. This is purely additive — it never removes
// a grant — which is safe because there's no role-editing UI yet
// (ARCHITECTURE.md), so there's no intentional customization to clobber.
//
// Run with: npm run db:backfill-permissions

const prisma = new PrismaClient();

async function main() {
  console.log("Backfilling role permissions...");

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

  const missing = roles.flatMap((role) => {
    const key = role.key as (typeof SYSTEM_ROLE_KEYS)[number];
    const already = new Set(role.rolePermissions.map((rp) => rp.permissionId));
    const defaults = ROLE_DEFAULT_PERMISSIONS[key] ?? [];
    return defaults
      .map((permKey) => permissionByKey.get(permKey))
      .filter((id): id is string => id !== undefined && !already.has(id))
      .map((permissionId) => ({ roleId: role.id, permissionId, schoolName: role.school?.name ?? "?", roleKey: key }));
  });

  if (missing.length > 0) {
    await prisma.rolePermission.createMany({
      data: missing.map(({ roleId, permissionId }) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
    const bySchool = new Map<string, Set<string>>();
    for (const m of missing) {
      if (!bySchool.has(m.schoolName)) bySchool.set(m.schoolName, new Set());
      bySchool.get(m.schoolName)!.add(m.roleKey);
    }
    for (const [school, roleKeys] of bySchool) {
      console.log(`  ${school}: granted new permissions to ${[...roleKeys].join(", ")}`);
    }
  }

  console.log(`\nChecked ${roles.length} role(s) across all schools, granted ${missing.length} missing permission(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
