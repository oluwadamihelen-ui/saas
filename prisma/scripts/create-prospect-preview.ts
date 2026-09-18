import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS, SYSTEM_ROLE_KEYS, SYSTEM_ROLE_LABELS, type SystemRoleKey } from "../../src/lib/permissions";
import { DEMO_PASSWORD } from "../../src/lib/demo";

// Spins up a single, richly-seeded, branded School for an in-person sales
// visit — the "show them what I already built for their school" pitch.
// Standalone script (see backfill-permissions.ts for why: anything under
// src/lib/services starts with `import "server-only"`, which throws
// outside Next's server bundle — this reimplements the handful of rules it
// needs inline instead of importing them).
//
// Run with:
//   npx tsx --tsconfig tsconfig.json prisma/scripts/create-prospect-preview.ts \
//     --name="Steadyflow International School" --slug=steadyflow \
//     [--logo=/path/to/logo.png] [--color=#1E40AF]
//
// The slug becomes the subdomain (steadyflow.schoolum.io) — requires a
// wildcard domain (*.<your-domain>) and matching wildcard DNS record to
// already be added on Vercel; see the printed reminder at the end of this
// script if that hasn't been done yet. Once that one-time setup exists,
// this script is the entire per-school workflow: run it before a visit,
// run delete-prospect-preview.ts after.

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lastWeekdays(count: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

function randomScore(max: number) {
  return Math.round(max * (0.55 + Math.random() * 0.42));
}

const FIRST_NAMES_M = ["Chinedu", "Emeka", "Tunde", "Ayodeji", "Ibrahim", "Segun", "Uche", "Kelechi", "Femi", "Musa", "Obinna", "Damilare"];
const FIRST_NAMES_F = ["Ngozi", "Amaka", "Funmilayo", "Aisha", "Chiamaka", "Bisi", "Halima", "Adaeze", "Yetunde", "Ifeoma", "Zainab", "Temitope"];
const LAST_NAMES = ["Okafor", "Adeyemi", "Balogun", "Eze", "Mohammed", "Okonkwo", "Adebayo", "Nwosu", "Bello", "Afolabi", "Chukwu", "Uzoma"];

function fileToDataUrl(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" }[ext];
  if (!mime) throw new Error(`Logo file must be .png, .jpg, .jpeg, .webp or .svg (got ${ext || "no extension"}).`);
  const buffer = fs.readFileSync(filePath);
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error("Logo file must be smaller than 2MB (same limit as the real Settings upload).");
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function main() {
  const name = arg("name");
  const slugArg = arg("slug");
  const logoPath = arg("logo");
  const color = arg("color");

  if (!name) {
    console.error('Missing --name="School Name"');
    process.exit(1);
  }
  const slug = slugArg ? slugify(slugArg) : slugify(name);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error(`Could not derive a usable slug from "${slugArg ?? name}". Pass --slug=something-simple explicitly.`);
    process.exit(1);
  }
  if (["demo", "www"].includes(slug)) {
    console.error(`"${slug}" is reserved and can't be used as a preview slug.`);
    process.exit(1);
  }
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    console.error(`--color must be a 6-digit hex code like #1E40AF (got "${color}").`);
    process.exit(1);
  }

  const existing = await prisma.school.findUnique({ where: { slug } });
  if (existing) {
    console.error(
      `A school with slug "${slug}" already exists (id ${existing.id}, created ${existing.createdAt.toISOString().slice(0, 10)}).\n` +
        `Run delete-prospect-preview.ts --slug=${slug} first if you want to replace it, or pick a different --slug.`
    );
    process.exit(1);
  }

  const logoUrl = logoPath ? fileToDataUrl(logoPath) : null;

  console.log(`Creating "${name}" preview at https://${slug}.schoolum.io ...`);

  await Promise.all(
    PERMISSION_CATALOG.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, module: p.module, action: p.key.split(".")[1] ?? p.key, description: p.description },
        update: {},
      })
    )
  );
  const permissionByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  const school = await prisma.school.create({
    data: {
      name,
      slug,
      status: "ACTIVE",
      logoUrl,
      brandColor: color,
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
    SYSTEM_ROLE_KEYS.map((key) => prisma.role.create({ data: { schoolId: school.id, key, name: SYSTEM_ROLE_LABELS[key], isSystem: true } }))
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
    { name: "Folake Adeyemi", email: `owner@${slug}.preview`, role: "SCHOOL_OWNER" },
    { name: "Chidi Okonkwo", email: `principal@${slug}.preview`, role: "PRINCIPAL" },
    { name: "Ngozi Balogun", email: `teacher@${slug}.preview`, role: "TEACHER" },
    { name: "Ibrahim Musa", email: `teacher2@${slug}.preview`, role: "TEACHER" },
    { name: "Grace Eze", email: `accountant@${slug}.preview`, role: "ACCOUNTANT" },
  ];
  const staffUsers = await Promise.all(
    staffSeeds.map((s) => prisma.user.create({ data: { schoolId: school.id, roleId: roleByKey.get(s.role)!.id, email: s.email, name: s.name, passwordHash } }))
  );
  const userByEmail = new Map(staffUsers.map((u) => [u.email, u]));
  const owner = userByEmail.get(`owner@${slug}.preview`)!;
  const teacher1 = userByEmail.get(`teacher@${slug}.preview`)!;
  const teacher2 = userByEmail.get(`teacher2@${slug}.preview`)!;
  const accountant = userByEmail.get(`accountant@${slug}.preview`)!;

  const thisYear = new Date().getFullYear();
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: `${thisYear}/${thisYear + 1}`, startDate: new Date(`${thisYear}-09-01`), endDate: new Date(`${thisYear + 1}-07-15`), isCurrent: true },
  });
  await prisma.term.createMany({
    data: [
      { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date(`${thisYear}-09-01`), endDate: new Date(`${thisYear}-12-13`), isCurrent: true },
      { schoolId: school.id, academicSessionId: session.id, name: "Second Term", startDate: new Date(`${thisYear + 1}-01-05`), endDate: new Date(`${thisYear + 1}-04-03`), isCurrent: false },
      { schoolId: school.id, academicSessionId: session.id, name: "Third Term", startDate: new Date(`${thisYear + 1}-04-20`), endDate: new Date(`${thisYear + 1}-07-15`), isCurrent: false },
    ],
  });
  const currentTerm = await prisma.term.findFirstOrThrow({ where: { schoolId: school.id, isCurrent: true } });

  await prisma.gradeBand.createMany({
    data: [
      { schoolId: school.id, grade: "A", minScore: 70, maxScore: 100, remark: "Excellent", order: 0 },
      { schoolId: school.id, grade: "B", minScore: 60, maxScore: 69, remark: "Very Good", order: 1 },
      { schoolId: school.id, grade: "C", minScore: 50, maxScore: 59, remark: "Good", order: 2 },
      { schoolId: school.id, grade: "D", minScore: 45, maxScore: 49, remark: "Pass", order: 3 },
      { schoolId: school.id, grade: "E", minScore: 40, maxScore: 44, remark: "Weak Pass", order: 4 },
      { schoolId: school.id, grade: "F", minScore: 0, maxScore: 39, remark: "Fail", order: 5 },
    ],
  });
  const assessmentComponents = await prisma.assessmentComponent.createManyAndReturn({
    data: [
      { schoolId: school.id, name: "1st CA", maxScore: 20, order: 0 },
      { schoolId: school.id, name: "2nd CA", maxScore: 20, order: 1 },
      { schoolId: school.id, name: "Exam", maxScore: 60, order: 2 },
    ],
  });

  const classPlan = [
    { name: "Primary 1", typicalAge: 6 },
    { name: "Primary 2", typicalAge: 7 },
    { name: "Primary 3", typicalAge: 8 },
    { name: "Primary 4", typicalAge: 9 },
    { name: "Primary 5", typicalAge: 10 },
  ];
  const classArms: { id: string; classGroupId: string; typicalAge: number }[] = [];
  const classGroups: { id: string; order: number }[] = [];
  for (const [index, group] of classPlan.entries()) {
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: group.name, order: index } });
    classGroups.push({ id: classGroup.id, order: index });
    const arm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
    classArms.push({ id: arm.id, classGroupId: classGroup.id, typicalAge: group.typicalAge });
  }

  const subjectRows = await prisma.subject.createManyAndReturn({
    data: ["Mathematics", "English Language", "Basic Science", "Social Studies", "Civic Education", "Creative Arts", "Computer Studies", "Physical Education"].map(
      (subjName, i) => ({ schoolId: school.id, name: subjName, code: `SUB${String(i + 1).padStart(3, "0")}` })
    ),
  });
  const mathematics = subjectRows.find((s) => s.name === "Mathematics")!;
  const english = subjectRows.find((s) => s.name === "English Language")!;

  console.log("Enrolling students...");
  const enrolledStudents: { id: string; classArmId: string }[] = [];
  let admissionSeq = 1;
  let demoStudentId: string | null = null;
  let demoGuardianId: string | null = null;
  for (let i = 0; i < 30; i++) {
    const isMale = Math.random() > 0.5;
    const firstName = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const arm = pick(classArms);
    const admissionNumber = `${thisYear}-${String(admissionSeq++).padStart(4, "0")}`;
    const birthYear = thisYear - arm.typicalAge;

    const student = await prisma.student.create({
      data: {
        schoolId: school.id, admissionNumber, firstName, lastName,
        gender: isMale ? "MALE" : "FEMALE",
        dateOfBirth: new Date(`${birthYear}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-15`),
        nationality: "Nigeria", classArmId: arm.id, status: "ACTIVE",
      },
    });
    enrolledStudents.push({ id: student.id, classArmId: arm.id });

    if (i === 0 || Math.random() > 0.2) {
      const guardianFirst = pick(isMale ? FIRST_NAMES_F : FIRST_NAMES_M);
      const guardian = await prisma.guardian.create({
        data: { schoolId: school.id, firstName: guardianFirst, lastName, phone: `+234 8${Math.floor(10000000 + Math.random() * 89999999)}`, email: `${guardianFirst.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com` },
      });
      await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, relationship: isMale ? "MOTHER" : "FATHER", isPrimary: true } });
      if (i === 0) {
        demoStudentId = student.id;
        demoGuardianId = guardian.id;
      }
    }
  }

  console.log("Setting up timetable, attendance, assignments and scores...");
  await prisma.teacherAssignment.createMany({
    data: classArms.flatMap((arm) => [
      { schoolId: school.id, teacherId: teacher1.id, subjectId: mathematics.id, classArmId: arm.id },
      { schoolId: school.id, teacherId: teacher2.id, subjectId: english.id, classArmId: arm.id },
    ]),
  });
  await prisma.timetableSlot.createMany({
    data: (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const).flatMap((day) =>
      classArms.flatMap((arm) => [
        { schoolId: school.id, classArmId: arm.id, subjectId: mathematics.id, teacherId: teacher1.id, dayOfWeek: day, startTime: "08:00", endTime: "08:40" },
        { schoolId: school.id, classArmId: arm.id, subjectId: english.id, teacherId: teacher2.id, dayOfWeek: day, startTime: "08:40", endTime: "09:20" },
      ])
    ),
  });
  await prisma.attendanceRecord.createMany({
    data: lastWeekdays(10).flatMap((date) =>
      enrolledStudents.map((s) => ({
        schoolId: school.id, studentId: s.id, classArmId: s.classArmId, termId: currentTerm.id, date,
        status: Math.random() > 0.1 ? ("PRESENT" as const) : Math.random() > 0.5 ? ("ABSENT" as const) : ("LATE" as const),
        markedById: teacher1.id,
      }))
    ),
  });

  const studentsByArm = new Map<string, string[]>();
  for (const s of enrolledStudents) {
    if (!studentsByArm.has(s.classArmId)) studentsByArm.set(s.classArmId, []);
    studentsByArm.get(s.classArmId)!.push(s.id);
  }

  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + 7);
  for (const arm of classArms) {
    const armStudents = studentsByArm.get(arm.id) ?? [];
    if (armStudents.length === 0) continue;
    const assignment = await prisma.assignment.create({
      data: { schoolId: school.id, classArmId: arm.id, subjectId: mathematics.id, teacherId: teacher1.id, termId: currentTerm.id, title: "Weekly problem set", description: "Complete the attached worksheet and show your working.", dueDate },
    });
    await prisma.assignmentSubmission.createMany({
      data: armStudents.map((studentId) => {
        const graded = Math.random() > 0.4;
        return { assignmentId: assignment.id, studentId, status: graded ? ("GRADED" as const) : ("PENDING" as const), score: graded ? randomScore(10) : null, gradedAt: graded ? new Date() : null, gradedById: graded ? teacher1.id : null };
      }),
    });
  }

  await prisma.score.createMany({
    data: enrolledStudents.flatMap((s) =>
      [mathematics, english].flatMap((subject) =>
        assessmentComponents.map((component) => ({
          schoolId: school.id, studentId: s.id, subjectId: subject.id, termId: currentTerm.id, componentId: component.id,
          value: randomScore(component.maxScore), enteredById: subject.id === mathematics.id ? teacher1.id : teacher2.id,
        }))
      )
    ),
  });

  console.log("Setting up fees, invoices and payments...");
  const feeCategoryRows = await prisma.feeCategory.createManyAndReturn({ data: ["Tuition", "Books", "Transport", "Uniform"].map((catName) => ({ schoolId: school.id, name: catName })) });
  const tuitionCategory = feeCategoryRows.find((c) => c.name === "Tuition")!;
  const booksCategory = feeCategoryRows.find((c) => c.name === "Books")!;

  const feeStructuresByGroup = new Map<string, { id: string; amountMinor: number }[]>();
  for (const group of classGroups) {
    const tuition = await prisma.feeStructure.create({
      data: { schoolId: school.id, categoryId: tuitionCategory.id, classGroupId: group.id, termId: currentTerm.id, name: `Tuition - ${currentTerm.name}`, amountMinor: 8_000_000 + group.order * 500_000 },
    });
    feeStructuresByGroup.set(group.id, [{ id: tuition.id, amountMinor: tuition.amountMinor }]);
  }
  const books = await prisma.feeStructure.create({ data: { schoolId: school.id, categoryId: booksCategory.id, classGroupId: null, termId: currentTerm.id, name: "Books & Learning Materials", amountMinor: 2_000_000 } });

  let invoiceSeq = 1;
  const invoiceDueDate = new Date(currentTerm.startDate);
  invoiceDueDate.setDate(invoiceDueDate.getDate() + 14);
  for (const arm of classArms) {
    const lineItems = [...(feeStructuresByGroup.get(arm.classGroupId) ?? []), { id: books.id, amountMinor: books.amountMinor }];
    const subtotalMinor = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
    for (const studentId of studentsByArm.get(arm.id) ?? []) {
      const invoice = await prisma.invoice.create({
        data: {
          schoolId: school.id, studentId, termId: currentTerm.id, invoiceNumber: `INV-${thisYear}-${String(invoiceSeq++).padStart(5, "0")}`,
          subtotalMinor, totalMinor: subtotalMinor, dueDate: invoiceDueDate, payToken: crypto.randomBytes(20).toString("hex"),
          items: { create: lineItems.map((item) => ({ feeStructureId: item.id, description: item.id === books.id ? "Books & Learning Materials" : `Tuition - ${currentTerm.name}`, amountMinor: item.amountMinor })) },
        },
      });
      const roll = Math.random();
      if (roll < 0.6) {
        await prisma.payment.create({ data: { schoolId: school.id, invoiceId: invoice.id, amountMinor: subtotalMinor, method: "MANUAL", status: "CONFIRMED", reference: crypto.randomBytes(12).toString("hex"), paidAt: new Date(), recordedById: accountant.id } });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
      } else if (roll < 0.85) {
        const partial = Math.round(subtotalMinor * 0.5);
        await prisma.payment.create({ data: { schoolId: school.id, invoiceId: invoice.id, amountMinor: partial, method: "BANK_TRANSFER", status: "CONFIRMED", reference: crypto.randomBytes(12).toString("hex"), paidAt: new Date(), recordedById: accountant.id } });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PARTIALLY_PAID" } });
      }
      // else: left ISSUED — an unpaid invoice on the books too, for realism.
    }
  }

  console.log("Setting up portal accounts and announcements...");
  const parentUser = await prisma.user.create({ data: { schoolId: school.id, roleId: roleByKey.get("PARENT")!.id, email: `parent@${slug}.preview`, name: "Demo Parent", passwordHash } });
  await prisma.guardian.update({ where: { id: demoGuardianId! }, data: { userId: parentUser.id } });
  const studentUser = await prisma.user.create({ data: { schoolId: school.id, roleId: roleByKey.get("STUDENT")!.id, email: `student@${slug}.preview`, name: "Demo Student", passwordHash } });
  await prisma.student.update({ where: { id: demoStudentId! }, data: { userId: studentUser.id } });

  await prisma.announcement.createMany({
    data: [
      { schoolId: school.id, title: "Welcome to the new term", body: `We're excited to welcome everyone back for the new term at ${name}.`, audience: "SCHOOL_WIDE", createdById: owner.id, publishedAt: new Date() },
      { schoolId: school.id, title: "PTA meeting reminder", body: "The termly PTA meeting holds this Saturday at 10am in the school hall.", audience: "PARENTS_ONLY", createdById: owner.id, publishedAt: new Date() },
    ],
  });

  console.log("\nDone.\n");
  console.log(`URL:      https://${slug}.schoolum.io`);
  console.log(`Password: ${DEMO_PASSWORD} (same for every account below)\n`);
  console.log(`  Owner:   owner@${slug}.preview`);
  console.log(`  Teacher: teacher@${slug}.preview`);
  console.log(`  Parent:  parent@${slug}.preview`);
  console.log(`  Student: student@${slug}.preview`);
  console.log(`\nWhen you're done with this prospect:`);
  console.log(`  npx tsx --tsconfig tsconfig.json prisma/scripts/delete-prospect-preview.ts --slug=${slug} --confirm`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
