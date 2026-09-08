import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  PERMISSION_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_LABELS,
} from "@/lib/permissions";

/// Idempotently ensures the global permission catalog exists. Safe to call
/// on every school creation — it's a handful of upserts, not a migration.
export async function ensurePermissionCatalog() {
  await Promise.all(
    PERMISSION_CATALOG.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, module: p.module, action: p.key.split(".")[1] ?? p.key, description: p.description },
        update: { module: p.module, description: p.description },
      })
    )
  );
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "school"
  );
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let attempt = 1;
  while (await prisma.school.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

/// Step 1 of onboarding: creates the tenant, seeds its system roles +
/// default permission matrix, and creates the owner's user account. All in
/// one transaction so a partially-created school never exists.
export async function createSchoolWithOwner(input: {
  schoolName: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
}) {
  const email = input.ownerEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  await ensurePermissionCatalog();
  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));
  const slug = await uniqueSlug(input.schoolName);
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { name: input.schoolName, slug },
    });

    const roles = await Promise.all(
      SYSTEM_ROLE_KEYS.map((key) =>
        tx.role.create({
          data: { schoolId: school.id, key, name: SYSTEM_ROLE_LABELS[key], isSystem: true },
        })
      )
    );
    const roleByKey = new Map(roles.map((r) => [r.key, r]));

    await tx.rolePermission.createMany({
      data: SYSTEM_ROLE_KEYS.flatMap((key) => {
        const role = roleByKey.get(key)!;
        return ROLE_DEFAULT_PERMISSIONS[key]
          .map((permKey) => permissionByKey.get(permKey))
          .filter((id): id is string => Boolean(id))
          .map((permissionId) => ({ roleId: role.id, permissionId }));
      }),
    });

    const ownerRole = roleByKey.get("SCHOOL_OWNER")!;
    const owner = await tx.user.create({
      data: {
        schoolId: school.id,
        roleId: ownerRole.id,
        email,
        passwordHash,
        name: input.ownerName,
      },
    });

    // Sensible defaults so score entry works immediately — editable later
    // from Results -> Grading setup rather than blocking onboarding on it.
    await tx.gradeBand.createMany({
      data: [
        { schoolId: school.id, grade: "A", minScore: 70, maxScore: 100, remark: "Excellent", order: 0 },
        { schoolId: school.id, grade: "B", minScore: 60, maxScore: 69, remark: "Very Good", order: 1 },
        { schoolId: school.id, grade: "C", minScore: 50, maxScore: 59, remark: "Good", order: 2 },
        { schoolId: school.id, grade: "D", minScore: 45, maxScore: 49, remark: "Pass", order: 3 },
        { schoolId: school.id, grade: "E", minScore: 40, maxScore: 44, remark: "Weak Pass", order: 4 },
        { schoolId: school.id, grade: "F", minScore: 0, maxScore: 39, remark: "Fail", order: 5 },
      ],
    });
    await tx.assessmentComponent.createMany({
      data: [
        { schoolId: school.id, name: "1st CA", maxScore: 20, order: 0 },
        { schoolId: school.id, name: "2nd CA", maxScore: 20, order: 1 },
        { schoolId: school.id, name: "Exam", maxScore: 60, order: 2 },
      ],
    });

    await tx.feeCategory.createMany({
      data: ["Tuition", "Boarding", "Transport", "Meals", "Uniform", "Books", "Other"].map((name) => ({
        schoolId: school.id,
        name,
      })),
    });
    await tx.expenseCategory.createMany({
      data: ["Salaries", "Utilities", "Maintenance", "Supplies", "Transport", "Other"].map((name) => ({
        schoolId: school.id,
        name,
      })),
    });

    return { school, owner };
  });
}
