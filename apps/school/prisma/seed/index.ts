import "dotenv/config";
import crypto from "crypto";
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
  return Math.round(max * (0.5 + Math.random() * 0.45));
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
      bankName: "GTBank",
      bankAccountName: schoolName,
      bankAccountNumber: "0123456789",
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
  const staffUsers = await Promise.all(
    staffSeeds.map((s) =>
      prisma.user.create({
        data: { schoolId: school.id, roleId: roleByKey.get(s.role)!.id, email: s.email, name: s.name, passwordHash },
      })
    )
  );
  const userByEmail = new Map(staffUsers.map((u) => [u.email, u]));
  const teacher1 = userByEmail.get("teacher1@winfield.demo")!;
  const teacher2 = userByEmail.get("teacher2@winfield.demo")!;
  const accountant = userByEmail.get("accountant@winfield.demo")!;
  const owner = userByEmail.get("owner@winfield.demo")!;

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
  const classArms: { id: string; classGroupId: string; typicalAge: number }[] = [];
  const classGroups: { id: string; order: number }[] = [];
  for (const [index, group] of classPlan.entries()) {
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: group.name, order: index } });
    classGroups.push({ id: classGroup.id, order: index });
    for (const armName of group.arms) {
      const arm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: armName } });
      classArms.push({ id: arm.id, classGroupId: classGroup.id, typicalAge: group.typicalAge });
    }
  }

  const subjects = [
    "Numeracy", "Literacy", "Phonics", "Basic Science and Technology", "Social Studies",
    "Civic Education", "Christian Religious Studies", "Cultural and Creative Arts",
    "Computer Studies", "French", "Verbal Reasoning", "Quantitative Reasoning",
    "Physical and Health Education", "Handwriting",
  ];
  const subjectRows = await prisma.subject.createManyAndReturn({
    data: subjects.map((name, i) => ({ schoolId: school.id, name, code: `SUB${String(i + 1).padStart(3, "0")}` })),
  });
  const numeracy = subjectRows.find((s) => s.name === "Numeracy")!;
  const literacy = subjectRows.find((s) => s.name === "Literacy")!;

  console.log("Enrolling demo students...");
  const enrolledStudents: { id: string; classArmId: string }[] = [];
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
    enrolledStudents.push({ id: student.id, classArmId });

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

  console.log("Assigning teachers, timetable, attendance, assignments and scores...");

  await prisma.teacherAssignment.createMany({
    data: classArms.flatMap((arm) => [
      { schoolId: school.id, teacherId: teacher1.id, subjectId: numeracy.id, classArmId: arm.id },
      { schoolId: school.id, teacherId: teacher2.id, subjectId: literacy.id, classArmId: arm.id },
    ]),
  });

  await prisma.timetableSlot.createMany({
    data: (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const).flatMap((day) =>
      classArms.flatMap((arm) => [
        { schoolId: school.id, classArmId: arm.id, subjectId: numeracy.id, teacherId: teacher1.id, dayOfWeek: day, startTime: "08:00", endTime: "08:40" },
        { schoolId: school.id, classArmId: arm.id, subjectId: literacy.id, teacherId: teacher2.id, dayOfWeek: day, startTime: "08:40", endTime: "09:20" },
      ])
    ),
  });

  await prisma.attendanceRecord.createMany({
    data: lastWeekdays(10).flatMap((date) =>
      enrolledStudents.map((s) => ({
        schoolId: school.id,
        studentId: s.id,
        classArmId: s.classArmId,
        termId: currentTerm.id,
        date,
        status: Math.random() > 0.12 ? ("PRESENT" as const) : Math.random() > 0.5 ? ("ABSENT" as const) : ("LATE" as const),
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
      data: {
        schoolId: school.id,
        classArmId: arm.id,
        subjectId: numeracy.id,
        teacherId: teacher1.id,
        termId: currentTerm.id,
        title: "Counting and number recognition",
        description: "Practice counting objects from 1 to 20 and writing the matching numeral.",
        dueDate,
      },
    });
    await prisma.assignmentSubmission.createMany({
      data: armStudents.map((studentId) => {
        const graded = Math.random() > 0.4;
        return {
          assignmentId: assignment.id,
          studentId,
          status: graded ? ("GRADED" as const) : ("PENDING" as const),
          score: graded ? randomScore(10) : null,
          gradedAt: graded ? new Date() : null,
          gradedById: graded ? teacher1.id : null,
        };
      }),
    });
  }

  await prisma.score.createMany({
    data: enrolledStudents.flatMap((s) =>
      [numeracy, literacy].flatMap((subject) =>
        assessmentComponents.map((component) => ({
          schoolId: school.id,
          studentId: s.id,
          subjectId: subject.id,
          termId: currentTerm.id,
          componentId: component.id,
          value: randomScore(component.maxScore),
          enteredById: subject.id === numeracy.id ? teacher1.id : teacher2.id,
        }))
      )
    ),
  });

  console.log("Setting up fees, invoices, payments and expenses...");

  const feeCategoryRows = await prisma.feeCategory.createManyAndReturn({
    data: ["Tuition", "Boarding", "Transport", "Meals", "Uniform", "Books", "Other"].map((name) => ({ schoolId: school.id, name })),
  });
  const tuitionCategory = feeCategoryRows.find((c) => c.name === "Tuition")!;
  const booksCategory = feeCategoryRows.find((c) => c.name === "Books")!;

  const expenseCategoryRows = await prisma.expenseCategory.createManyAndReturn({
    data: ["Salaries", "Utilities", "Maintenance", "Supplies", "Transport", "Other"].map((name) => ({ schoolId: school.id, name })),
  });

  const vendor = await prisma.vendor.create({
    data: { schoolId: school.id, name: "Lagos Facilities Services", contactInfo: "+234 802 555 0100" },
  });

  // Tuition scales with class level; a flat book levy applies to everyone.
  const feeStructuresByGroup = new Map<string, { id: string; amountMinor: number }[]>();
  for (const group of classGroups) {
    const tuition = await prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        categoryId: tuitionCategory.id,
        classGroupId: group.id,
        termId: currentTerm.id,
        name: "Tuition - " + currentTerm.name,
        amountMinor: 8_000_000 + group.order * 500_000, // NGN 80,000 rising with class level
      },
    });
    feeStructuresByGroup.set(group.id, [{ id: tuition.id, amountMinor: tuition.amountMinor }]);
  }
  const books = await prisma.feeStructure.create({
    data: {
      schoolId: school.id,
      categoryId: booksCategory.id,
      classGroupId: null,
      termId: currentTerm.id,
      name: "Books & Learning Materials",
      amountMinor: 2_000_000, // NGN 20,000
    },
  });

  let invoiceSeq = 1;
  const invoiceDueDate = new Date(currentTerm.startDate);
  invoiceDueDate.setDate(invoiceDueDate.getDate() + 14);

  for (const arm of classArms) {
    const groupStructures = feeStructuresByGroup.get(arm.classGroupId) ?? [];
    const lineItems = [...groupStructures, { id: books.id, amountMinor: books.amountMinor }];
    const subtotalMinor = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
    const armStudentIds = studentsByArm.get(arm.id) ?? [];

    for (const studentId of armStudentIds) {
      const invoice = await prisma.invoice.create({
        data: {
          schoolId: school.id,
          studentId,
          termId: currentTerm.id,
          invoiceNumber: `INV-${thisYear}-${String(invoiceSeq++).padStart(5, "0")}`,
          subtotalMinor,
          totalMinor: subtotalMinor,
          dueDate: invoiceDueDate,
          payToken: crypto.randomBytes(20).toString("hex"),
          items: {
            create: lineItems.map((item) => ({
              feeStructureId: item.id,
              description: item.id === books.id ? "Books & Learning Materials" : `Tuition - ${currentTerm.name}`,
              amountMinor: item.amountMinor,
            })),
          },
        },
      });

      // Realistic payment mix: most parents have paid in full, some paid
      // half, a few haven't paid yet, and one has a transfer awaiting
      // confirmation — so the finance dashboard has something to show.
      const roll = Math.random();
      if (roll < 0.6) {
        await prisma.payment.create({
          data: {
            schoolId: school.id, invoiceId: invoice.id, amountMinor: subtotalMinor,
            method: "MANUAL", status: "CONFIRMED", reference: crypto.randomBytes(12).toString("hex"),
            paidAt: new Date(), recordedById: accountant.id,
          },
        });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
      } else if (roll < 0.85) {
        const partial = Math.round(subtotalMinor * 0.5);
        await prisma.payment.create({
          data: {
            schoolId: school.id, invoiceId: invoice.id, amountMinor: partial,
            method: "BANK_TRANSFER", status: "CONFIRMED", reference: crypto.randomBytes(12).toString("hex"),
            paidAt: new Date(), recordedById: accountant.id,
          },
        });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PARTIALLY_PAID" } });
      } else if (roll < 0.92) {
        await prisma.payment.create({
          data: {
            schoolId: school.id, invoiceId: invoice.id, amountMinor: subtotalMinor,
            method: "BANK_TRANSFER", status: "PENDING", reference: crypto.randomBytes(12).toString("hex"),
          },
        });
      }
      // else: left ISSUED with no payment at all.
    }
  }

  const expenseSeeds: { category: string; description: string; amountMinor: number; daysAgo: number }[] = [
    { category: "Salaries", description: "Teaching staff salaries - " + currentTerm.name, amountMinor: 120_000_000, daysAgo: 20 },
    { category: "Utilities", description: "Electricity bill", amountMinor: 1_800_000, daysAgo: 12 },
    { category: "Maintenance", description: "Playground equipment repair", amountMinor: 3_500_000, daysAgo: 8 },
    { category: "Supplies", description: "Classroom stationery restock", amountMinor: 900_000, daysAgo: 5 },
    { category: "Transport", description: "School bus fuel", amountMinor: 1_200_000, daysAgo: 3 },
  ];
  for (const e of expenseSeeds) {
    const category = expenseCategoryRows.find((c) => c.name === e.category)!;
    const needsApproval = e.amountMinor >= school.expenseApprovalThresholdMinor;
    const incurredAt = new Date();
    incurredAt.setDate(incurredAt.getDate() - e.daysAgo);
    await prisma.expense.create({
      data: {
        schoolId: school.id,
        categoryId: category.id,
        vendorId: vendor.id,
        description: e.description,
        amountMinor: e.amountMinor,
        incurredAt,
        createdById: accountant.id,
        status: needsApproval ? "PENDING" : "APPROVED",
        approvedById: needsApproval ? null : owner.id,
        approvedAt: needsApproval ? null : new Date(),
      },
    });
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
