import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  PERMISSION_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_LABELS,
  type SystemRoleKey,
} from "../../src/lib/permissions";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Passw0rd!23";

const FIRST_NAMES_M = [
  "Chinedu", "Emeka", "Tunde", "Ayodeji", "Ibrahim", "Segun", "Uche", "Kelechi",
  "Femi", "Chukwuemeka", "Musa", "Obinna", "Damilare", "Adewale", "Yusuf",
  "Chibuike", "Olumide", "Kayode", "Ikenna", "Suleiman",
];
const FIRST_NAMES_F = [
  "Ngozi", "Amaka", "Funmilayo", "Aisha", "Chiamaka", "Bisi", "Halima", "Adaeze",
  "Yetunde", "Ifeoma", "Zainab", "Temitope", "Blessing", "Oluwaseun", "Grace",
  "Chidinma", "Folasade", "Rukayat", "Nkechi", "Omolara",
];
const LAST_NAMES = [
  "Okafor", "Adeyemi", "Balogun", "Eze", "Mohammed", "Okonkwo", "Adebayo",
  "Nwosu", "Bello", "Afolabi", "Chukwu", "Yusuf", "Uzoma", "Ogunleye",
  "Abubakar", "Nnamdi", "Ojo", "Ibrahim", "Okeke", "Lawal",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Seeding demo school...");

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

  const schoolName = "Winfield Montessori School";
  const slug = slugify(schoolName);
  await prisma.school.deleteMany({ where: { slug } });

  const school = await prisma.school.create({
    data: {
      name: schoolName,
      slug,
      status: "ACTIVE",
      email: "info@winfield.demo",
      phone: "+234 801 234 5678",
      website: "https://winfield.demo",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      currency: "NGN",
      timezone: "Africa/Lagos",
      schoolInfoCompletedAt: new Date(),
      academicStructureSetupAt: new Date(),
      staffInvitedAt: new Date(),
      onboardingCompletedAt: new Date(),
    },
  });

  const roles = await Promise.all(
    SYSTEM_ROLE_KEYS.map((key) =>
      prisma.role.create({ data: { schoolId: school.id, key, name: SYSTEM_ROLE_LABELS[key], isSystem: true } })
    )
  );
  const roleByKey = new Map(roles.map((r) => [r.key, r]));

  await prisma.rolePermission.createMany({
    data: SYSTEM_ROLE_KEYS.flatMap((key) => {
      const role = roleByKey.get(key)!;
      return ROLE_DEFAULT_PERMISSIONS[key]
        .map((permKey) => permissionByKey.get(permKey))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));
    }),
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staffSeeds: { name: string; email: string; role: SystemRoleKey }[] = [
    { name: "Adaeze Nwankwo", email: "owner@winfield.demo", role: "SCHOOL_OWNER" },
    { name: "Emeka Obi", email: "admin@winfield.demo", role: "SCHOOL_ADMIN" },
    { name: "Funmilayo Adekunle", email: "principal@winfield.demo", role: "PRINCIPAL" },
    { name: "Tunde Bakare", email: "teacher1@winfield.demo", role: "TEACHER" },
    { name: "Amaka Chukwu", email: "teacher2@winfield.demo", role: "TEACHER" },
    { name: "Ibrahim Sule", email: "accountant@winfield.demo", role: "ACCOUNTANT" },
    { name: "Blessing Eze", email: "hr@winfield.demo", role: "HR_STAFF" },
  ];
  await Promise.all(
    staffSeeds.map((s) =>
      prisma.user.create({
        data: { schoolId: school.id, roleId: roleByKey.get(s.role)!.id, email: s.email, name: s.name, passwordHash },
      })
    )
  );

  const thisYear = new Date().getFullYear();
  const session = await prisma.academicSession.create({
    data: {
      schoolId: school.id,
      name: `${thisYear}/${thisYear + 1}`,
      startDate: new Date(`${thisYear}-09-01`),
      endDate: new Date(`${thisYear + 1}-07-15`),
      isCurrent: true,
    },
  });
  const termSpans: [string, string, string, boolean][] = [
    ["First Term", `${thisYear}-09-01`, `${thisYear}-12-13`, true],
    ["Second Term", `${thisYear + 1}-01-05`, `${thisYear + 1}-04-03`, false],
    ["Third Term", `${thisYear + 1}-04-20`, `${thisYear + 1}-07-15`, false],
  ];
  await prisma.term.createMany({
    data: termSpans.map(([name, start, end, isCurrent]) => ({
      schoolId: school.id,
      academicSessionId: session.id,
      name,
      startDate: new Date(start),
      endDate: new Date(end),
      isCurrent,
    })),
  });

  // Winfield is a Creche, Nursery & Primary school — not secondary classes.
  const classPlan: { name: string; arms: string[]; typicalAge: number }[] = [
    { name: "Creche", arms: ["A"], typicalAge: 2 },
    { name: "Pre-Nursery", arms: ["A"], typicalAge: 3 },
    { name: "Nursery 1", arms: ["A"], typicalAge: 4 },
    { name: "Nursery 2", arms: ["A", "B"], typicalAge: 5 },
    { name: "Primary 1", arms: ["A", "B"], typicalAge: 6 },
    { name: "Primary 2", arms: ["A", "B"], typicalAge: 7 },
    { name: "Primary 3", arms: ["A", "B"], typicalAge: 8 },
    { name: "Primary 4", arms: ["A"], typicalAge: 9 },
    { name: "Primary 5", arms: ["A"], typicalAge: 10 },
    { name: "Primary 6", arms: ["A"], typicalAge: 11 },
  ];
  const classArms: { id: string; typicalAge: number }[] = [];
  for (const [index, group] of classPlan.entries()) {
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: group.name, order: index } });
    for (const armName of group.arms) {
      const arm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: armName } });
      classArms.push({ id: arm.id, typicalAge: group.typicalAge });
    }
  }

  const subjects = [
    "Numeracy", "Literacy", "Phonics", "Basic Science and Technology", "Social Studies",
    "Civic Education", "Christian Religious Studies", "Cultural and Creative Arts",
    "Computer Studies", "French", "Verbal Reasoning", "Quantitative Reasoning",
    "Physical and Health Education", "Handwriting",
  ];
  await prisma.subject.createMany({
    data: subjects.map((name, i) => ({ schoolId: school.id, name, code: `SUB${String(i + 1).padStart(3, "0")}` })),
  });

  console.log("Enrolling demo students...");
  let admissionSeq = 1;
  for (let i = 0; i < 110; i++) {
    const isMale = Math.random() > 0.5;
    const firstName = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const arm = pick(classArms);
    const classArmId = arm.id;
    const admissionNumber = `${thisYear}-${String(admissionSeq++).padStart(4, "0")}`;
    const birthYear = thisYear - arm.typicalAge - Math.floor(Math.random() * 2);

    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        admissionNumber,
        firstName,
        lastName,
        gender: isMale ? "MALE" : "FEMALE",
        dateOfBirth: new Date(`${birthYear}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-15`),
        nationality: "Nigeria",
        city: "Lagos",
        state: "Lagos",
        classArmId,
        status: "ACTIVE",
      },
    });

    if (Math.random() > 0.2) {
      const guardianFirst = pick(isMale ? FIRST_NAMES_F : FIRST_NAMES_M);
      const guardian = await prisma.guardian.create({
        data: {
          schoolId: school.id,
          firstName: guardianFirst,
          lastName,
          phone: `+234 8${Math.floor(10000000 + Math.random() * 89999999)}`,
          email: `${guardianFirst.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        },
      });
      await prisma.studentGuardian.create({
        data: { studentId: student.id, guardianId: guardian.id, relationship: isMale ? "MOTHER" : "FATHER", isPrimary: true },
      });
    }
  }

  console.log(`\nSeeded "${schoolName}" with ${classArms.length} class arms and 110 students.`);
  console.log(`All staff accounts use the password: ${DEMO_PASSWORD}\n`);
  for (const s of staffSeeds) console.log(`  ${s.role.padEnd(16)} ${s.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
