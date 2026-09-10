import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import {
  PERMISSION_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_LABELS,
  type SystemRoleKey,
} from "../../src/lib/permissions";
import { PLAN_CATALOG, PLAN_TIERS, TRIAL_PERIOD_DAYS } from "../../src/lib/billing/plan-catalog";

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

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

/// Staff had no Date of Birth on record at all before the Upcoming
/// Birthdays feature — this gives every seeded staff account a realistic
/// one (age 26-58) so the feature has real data to demonstrate on a fresh
/// install, same as students already had.
function randomStaffDateOfBirth(): Date {
  const thisYear = new Date().getFullYear();
  const birthYear = thisYear - (26 + Math.floor(Math.random() * 32));
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return new Date(`${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
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
    { name: "Chidinma Okoro", email: "librarian@winfield.demo", role: "LIBRARIAN" },
    { name: "Segun Afolabi", email: "transport@winfield.demo", role: "TRANSPORT_MANAGER" },
  ];
  const staffUsers = await Promise.all(
    staffSeeds.map((s) =>
      prisma.user.create({
        data: { schoolId: school.id, roleId: roleByKey.get(s.role)!.id, email: s.email, name: s.name, passwordHash, dateOfBirth: randomStaffDateOfBirth() },
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
  const classGroupByName = new Map<string, { id: string; order: number }>();
  for (const [index, group] of classPlan.entries()) {
    const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: group.name, order: index } });
    classGroups.push({ id: classGroup.id, order: index });
    classGroupByName.set(group.name, { id: classGroup.id, order: index });
    for (const armName of group.arms) {
      const arm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: armName } });
      classArms.push({ id: arm.id, classGroupId: classGroup.id, typicalAge: group.typicalAge });
    }
  }

  const subjects = [
    "Numeracy", "Literacy", "English Language", "Phonics", "Basic Science and Technology", "Social Studies",
    "Civic Education", "Christian Religious Studies", "Cultural and Creative Arts",
    "Computer Studies", "French", "Verbal Reasoning", "Quantitative Reasoning",
    "Physical and Health Education", "Handwriting",
  ];
  const subjectRows = await prisma.subject.createManyAndReturn({
    data: subjects.map((name, i) => ({ schoolId: school.id, name, code: `SUB${String(i + 1).padStart(3, "0")}` })),
  });
  const numeracy = subjectRows.find((s) => s.name === "Numeracy")!;
  const literacy = subjectRows.find((s) => s.name === "Literacy")!;
  const englishLanguage = subjectRows.find((s) => s.name === "English Language")!;

  console.log("Enrolling demo students...");
  const enrolledStudents: { id: string; classArmId: string }[] = [];
  let admissionSeq = 1;
  let demoStudentId: string | null = null;
  let demoGuardianId: string | null = null;
  let demoClassArmId: string | null = null;
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

    // The very first enrolled student always gets a guardian, so there's a
    // guaranteed family to attach the demo portal accounts (below) to —
    // everyone else keeps the random 80% chance.
    if (i === 0 || Math.random() > 0.2) {
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
      if (i === 0) {
        demoStudentId = student.id;
        demoGuardianId = guardian.id;
        demoClassArmId = classArmId;
      }
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

  console.log("Setting up Pre-School Milestone Results demo data...");

  // Brief-specified demo: Nursery 1 assessed by milestones (not scores), an
  // English Language Scheme of Work with 3 weeks/4 milestones, and a
  // student "Abayo" with the example assessments — so a fresh install has
  // something to click through immediately.
  const nursery1 = classGroupByName.get("Nursery 1")!;
  const nursery1Arm = classArms.find((a) => a.classGroupId === nursery1.id)!;
  await prisma.classGroup.update({ where: { id: nursery1.id }, data: { assessmentMode: "MILESTONE" } });

  const abayoAdmissionNumber = `${thisYear}-${String(admissionSeq++).padStart(4, "0")}`;
  const abayo = await prisma.student.create({
    data: {
      schoolId: school.id,
      admissionNumber: abayoAdmissionNumber,
      firstName: "Abayo",
      lastName: "Adewale",
      gender: "MALE",
      dateOfBirth: new Date(`${thisYear - 4}-03-10`),
      nationality: "Nigeria",
      city: "Lagos",
      state: "Lagos",
      classArmId: nursery1Arm.id,
      status: "ACTIVE",
    },
  });

  const englishScheme = await prisma.schemeOfWork.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: currentTerm.id,
      classGroupId: nursery1.id,
      subjectId: englishLanguage.id,
      createdById: teacher2.id,
    },
  });

  const weekPlan: { weekNumber: number; title: string; milestones: string[] }[] = [
    { weekNumber: 1, title: "Pronouns", milestones: ["Identify pronouns", "Underline pronouns mixed with other parts of speech"] },
    { weekNumber: 2, title: "Adjectives", milestones: ["Make sentences using adjectives"] },
    { weekNumber: 3, title: "Adverbs", milestones: ["Identify common adverbs"] },
  ];
  const milestoneByTitle = new Map<string, { id: string }>();
  for (const [index, week] of weekPlan.entries()) {
    const topic = await prisma.schemeOfWorkTopic.create({
      data: { schoolId: school.id, schemeOfWorkId: englishScheme.id, weekNumber: week.weekNumber, title: week.title, order: index },
    });
    for (const [mIndex, title] of week.milestones.entries()) {
      const milestone = await prisma.preschoolMilestone.create({
        data: { schoolId: school.id, topicId: topic.id, title, order: mIndex, createdById: teacher2.id },
      });
      milestoneByTitle.set(title, { id: milestone.id });
    }
  }

  const continuousAssessment = await prisma.preschoolAssessmentPeriod.create({
    data: { schoolId: school.id, termId: currentTerm.id, name: "Continuous Assessment", type: "CONTINUOUS_ASSESSMENT" },
  });

  const abayoAssessments: { title: string; level: "EXCEEDED" | "ACHIEVED" | "PROGRESSING" | "DEVELOPING" | "NEEDS_SUPPORT" }[] = [
    { title: "Identify pronouns", level: "ACHIEVED" },
    { title: "Underline pronouns mixed with other parts of speech", level: "DEVELOPING" },
    { title: "Make sentences using adjectives", level: "ACHIEVED" },
    { title: "Identify common adverbs", level: "NEEDS_SUPPORT" },
  ];
  await prisma.preschoolMilestoneAssessment.createMany({
    data: abayoAssessments.map((a) => ({
      schoolId: school.id,
      studentId: abayo.id,
      milestoneId: milestoneByTitle.get(a.title)!.id,
      subjectId: englishLanguage.id,
      termId: currentTerm.id,
      assessmentPeriodId: continuousAssessment.id,
      level: a.level,
      assessedById: teacher2.id,
    })),
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

  console.log("Setting up payroll, library, transport and hostel...");

  const admin = userByEmail.get("admin@winfield.demo")!;
  const principal = userByEmail.get("principal@winfield.demo")!;
  const librarian = userByEmail.get("librarian@winfield.demo")!;

  // Payroll — Owner, Librarian and Transport Manager are deliberately left
  // without a salary structure, so the payroll page's "not configured yet"
  // state has something real to show.
  const salaryComponentSeeds: { name: string; type: "EARNING" | "DEDUCTION" }[] = [
    { name: "Basic Salary", type: "EARNING" },
    { name: "Housing Allowance", type: "EARNING" },
    { name: "Transport Allowance", type: "EARNING" },
    { name: "PAYE Tax", type: "DEDUCTION" },
    { name: "Pension", type: "DEDUCTION" },
  ];
  const salaryComponents = await prisma.salaryComponent.createManyAndReturn({
    data: salaryComponentSeeds.map((c) => ({ schoolId: school.id, name: c.name, type: c.type })),
  });
  const componentByName = new Map(salaryComponents.map((c) => [c.name, c]));

  const salaryStructureSeeds: { user: { id: string }; basic: number; housing: number; transportAllowance: number; tax: number; pension: number }[] = [
    { user: admin, basic: 25_000_00, housing: 5_000_00, transportAllowance: 3_000_00, tax: 2_000_00, pension: 1_500_00 },
    { user: principal, basic: 30_000_00, housing: 6_000_00, transportAllowance: 3_500_00, tax: 2_500_00, pension: 1_800_00 },
    { user: teacher1, basic: 15_000_00, housing: 3_000_00, transportAllowance: 2_000_00, tax: 1_000_00, pension: 900_00 },
    { user: teacher2, basic: 15_000_00, housing: 3_000_00, transportAllowance: 2_000_00, tax: 1_000_00, pension: 900_00 },
    { user: accountant, basic: 18_000_00, housing: 3_500_00, transportAllowance: 2_500_00, tax: 1_200_00, pension: 1_080_00 },
    { user: userByEmail.get("hr@winfield.demo")!, basic: 14_000_00, housing: 2_800_00, transportAllowance: 1_800_00, tax: 900_00, pension: 840_00 },
  ];

  for (const s of salaryStructureSeeds) {
    const structure = await prisma.staffSalaryStructure.create({ data: { schoolId: school.id, userId: s.user.id } });
    await prisma.staffSalaryItem.createMany({
      data: [
        { structureId: structure.id, componentId: componentByName.get("Basic Salary")!.id, amountMinor: s.basic },
        { structureId: structure.id, componentId: componentByName.get("Housing Allowance")!.id, amountMinor: s.housing },
        { structureId: structure.id, componentId: componentByName.get("Transport Allowance")!.id, amountMinor: s.transportAllowance },
        { structureId: structure.id, componentId: componentByName.get("PAYE Tax")!.id, amountMinor: s.tax },
        { structureId: structure.id, componentId: componentByName.get("Pension")!.id, amountMinor: s.pension },
      ],
    });
  }

  /// Mirrors generatePayrollRun in src/lib/services/payroll.ts — duplicated
  /// here rather than imported because that file is "server-only" and this
  /// script runs outside Next's server bundle (see backfill-permissions.ts
  /// for the same constraint).
  async function seedPayrollRun(month: number, year: number, status: "DRAFT" | "APPROVED" | "PAID") {
    const run = await prisma.payrollRun.create({
      data: {
        schoolId: school.id,
        month,
        year,
        status,
        createdById: admin.id,
        approvedById: status !== "DRAFT" ? owner.id : null,
        approvedAt: status !== "DRAFT" ? new Date() : null,
        paidAt: status === "PAID" ? new Date() : null,
      },
    });
    const structures = await prisma.staffSalaryStructure.findMany({
      where: { schoolId: school.id },
      include: { items: { include: { component: true } } },
    });
    await prisma.payslip.createMany({
      data: structures.map((s) => {
        const gross = s.items.filter((i) => i.component.type === "EARNING").reduce((sum, i) => sum + i.amountMinor, 0);
        const deductions = s.items.filter((i) => i.component.type === "DEDUCTION").reduce((sum, i) => sum + i.amountMinor, 0);
        return {
          schoolId: school.id,
          payrollRunId: run.id,
          userId: s.userId,
          items: s.items.map((i) => ({ componentName: i.component.name, type: i.component.type, amountMinor: i.amountMinor })) as unknown as Prisma.InputJsonValue,
          grossMinor: gross,
          totalDeductionsMinor: deductions,
          netMinor: gross - deductions,
        };
      }),
    });
  }

  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  await seedPayrollRun(lastMonthDate.getMonth() + 1, lastMonthDate.getFullYear(), "PAID");
  const thisMonthDate = new Date();
  await seedPayrollRun(thisMonthDate.getMonth() + 1, thisMonthDate.getFullYear(), "DRAFT");

  // Library
  const bookSeeds: { title: string; author: string; category: string; totalCopies: number }[] = [
    { title: "Things Fall Apart", author: "Chinua Achebe", category: "Fiction", totalCopies: 5 },
    { title: "Half of a Yellow Sun", author: "Chimamanda Ngozi Adichie", category: "Fiction", totalCopies: 4 },
    { title: "Concise Oxford English Dictionary", author: "Oxford University Press", category: "Reference", totalCopies: 10 },
    { title: "Introduction to Mathematics", author: "Ministry of Education", category: "Textbook", totalCopies: 20 },
    { title: "Basic Science for Primary Schools", author: "Ministry of Education", category: "Textbook", totalCopies: 20 },
    { title: "Nigerian History for Young Readers", author: "Tunde Fagbenle", category: "History", totalCopies: 6 },
  ];
  const seededBooks = await prisma.book.createManyAndReturn({ data: bookSeeds.map((b) => ({ schoolId: school.id, ...b })) });

  for (const [i, student] of enrolledStudents.slice(0, 6).entries()) {
    const book = seededBooks[i % seededBooks.length];
    const issuedAt = new Date();
    issuedAt.setDate(issuedAt.getDate() - (5 + i));
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + 14);
    const alreadyReturned = i % 3 === 0;
    await prisma.bookLoan.create({
      data: {
        schoolId: school.id,
        bookId: book.id,
        borrowerStudentId: student.id,
        issuedById: librarian.id,
        issuedAt,
        dueAt,
        status: alreadyReturned ? "RETURNED" : "ISSUED",
        returnedAt: alreadyReturned ? new Date() : null,
      },
    });
  }
  await prisma.bookLoan.create({
    data: {
      schoolId: school.id,
      bookId: seededBooks[0].id,
      borrowerUserId: teacher1.id,
      issuedById: librarian.id,
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "ISSUED",
    },
  });

  // Transport
  const vehicle1 = await prisma.vehicle.create({
    data: { schoolId: school.id, name: "Bus 1", plateNumber: "LND-234-XY", capacity: 30, driverName: "Musa Garba", driverPhone: "+234 802 111 2222" },
  });
  const vehicle2 = await prisma.vehicle.create({
    data: { schoolId: school.id, name: "Bus 2", plateNumber: "LND-567-AB", capacity: 25, driverName: "Peter Okoro", driverPhone: "+234 803 333 4444" },
  });

  const route1 = await prisma.transportRoute.create({ data: { schoolId: school.id, name: "Route A - Ikeja", vehicleId: vehicle1.id } });
  const route1Stops = await prisma.routeStop.createManyAndReturn({
    data: [
      { schoolId: school.id, routeId: route1.id, name: "Allen Avenue Junction", order: 0, pickupTime: "06:45", dropoffTime: "15:15" },
      { schoolId: school.id, routeId: route1.id, name: "Opebi Road", order: 1, pickupTime: "06:55", dropoffTime: "15:05" },
    ],
  });
  const route2 = await prisma.transportRoute.create({ data: { schoolId: school.id, name: "Route B - Lekki", vehicleId: vehicle2.id } });
  const route2Stops = await prisma.routeStop.createManyAndReturn({
    data: [{ schoolId: school.id, routeId: route2.id, name: "Lekki Phase 1 Gate", order: 0, pickupTime: "06:30", dropoffTime: "15:30" }],
  });

  for (const [i, student] of enrolledStudents.slice(6, 16).entries()) {
    const onRouteOne = i % 2 === 0;
    await prisma.studentTransportAssignment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        routeId: onRouteOne ? route1.id : route2.id,
        stopId: onRouteOne ? pick(route1Stops).id : pick(route2Stops).id,
      },
    });
  }

  // Hostel
  const hostel1 = await prisma.hostel.create({
    data: { schoolId: school.id, name: "Unity Hostel", type: "MALE", wardenName: "Mr. Bassey", wardenPhone: "+234 804 555 6666" },
  });
  const hostel2 = await prisma.hostel.create({
    data: { schoolId: school.id, name: "Grace Hostel", type: "FEMALE", wardenName: "Mrs. Adeyemi", wardenPhone: "+234 805 777 8888" },
  });
  const rooms1 = await prisma.hostelRoom.createManyAndReturn({
    data: [
      { schoolId: school.id, hostelId: hostel1.id, roomNumber: "A1", capacity: 4 },
      { schoolId: school.id, hostelId: hostel1.id, roomNumber: "A2", capacity: 4 },
    ],
  });
  const rooms2 = await prisma.hostelRoom.createManyAndReturn({
    data: [
      { schoolId: school.id, hostelId: hostel2.id, roomNumber: "B1", capacity: 4 },
      { schoolId: school.id, hostelId: hostel2.id, roomNumber: "B2", capacity: 4 },
    ],
  });

  for (const [i, student] of enrolledStudents.slice(16, 24).entries()) {
    const rooms = i % 2 === 0 ? rooms1 : rooms2;
    await prisma.hostelBedAssignment.create({
      data: { schoolId: school.id, studentId: student.id, roomId: rooms[i % rooms.length].id },
    });
  }

  console.log("Setting up portal accounts, announcements and messages...");

  const PORTAL_PASSWORD_HASH = passwordHash;

  const parentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      roleId: roleByKey.get("PARENT")!.id,
      email: "parent@winfield.demo",
      name: "Demo Parent",
      passwordHash: PORTAL_PASSWORD_HASH,
    },
  });
  await prisma.guardian.update({ where: { id: demoGuardianId! }, data: { userId: parentUser.id } });

  const studentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      roleId: roleByKey.get("STUDENT")!.id,
      email: "student@winfield.demo",
      name: "Demo Student",
      passwordHash: PORTAL_PASSWORD_HASH,
    },
  });
  await prisma.student.update({ where: { id: demoStudentId! }, data: { userId: studentUser.id } });

  const announcementSeeds: {
    title: string;
    body: string;
    audience: "SCHOOL_WIDE" | "STAFF_ONLY" | "PARENTS_ONLY" | "CLASS";
    classArmId?: string;
    createdById: string;
  }[] = [
    {
      title: "Mid-term break notice",
      body: "The school will be closed for mid-term break from Friday to the following Monday. Classes resume as usual on Tuesday.",
      audience: "SCHOOL_WIDE",
      createdById: owner.id,
    },
    {
      title: "Staff meeting - Friday",
      body: "All staff are to attend the end-of-term review meeting in the staff room at 3:30pm on Friday.",
      audience: "STAFF_ONLY",
      createdById: principal.id,
    },
    {
      title: "PTA meeting reminder",
      body: "The termly PTA meeting holds this Saturday at 10am in the school hall. All parents are encouraged to attend.",
      audience: "PARENTS_ONLY",
      createdById: owner.id,
    },
    {
      title: "Excursion permission slips due",
      body: "Please return signed excursion permission slips to the class teacher by Wednesday.",
      audience: "CLASS",
      classArmId: demoClassArmId!,
      createdById: teacher1.id,
    },
  ];
  for (const a of announcementSeeds) {
    await prisma.announcement.create({
      data: {
        schoolId: school.id,
        title: a.title,
        body: a.body,
        audience: a.audience,
        classArmId: a.classArmId ?? null,
        createdById: a.createdById,
        publishedAt: new Date(),
      },
    });
  }

  const conversation = await prisma.conversation.create({
    data: {
      schoolId: school.id,
      initiatedById: parentUser.id,
      subject: "Question about the school bus route",
      studentId: demoStudentId!,
      messages: {
        create: { schoolId: school.id, senderId: parentUser.id, body: "Hi, does the school bus cover the Lekki Phase 1 area this term?" },
      },
    },
  });
  await prisma.message.create({
    data: {
      schoolId: school.id,
      conversationId: conversation.id,
      senderId: accountant.id,
      body: "Yes, the Lekki route runs every school day. Please share your address and we'll confirm the pickup point.",
    },
  });

  console.log("Setting up administration (calendar, feedback, admission)...");

  await prisma.school.update({ where: { id: school.id }, data: { admissionFeeMinor: 1_500_00 } });

  const calendarEventSeeds: {
    title: string;
    description: string;
    daysFromNow: number;
    durationHours: number;
    classArmId?: string;
    termId?: string;
    notifyAudience?: "PARENTS" | "STAFF" | "BOTH";
  }[] = [
    { title: "Mid-term break", description: "School closed for mid-term break.", daysFromNow: 10, durationHours: 96, notifyAudience: "BOTH" },
    { title: "PTA meeting", description: "Termly PTA meeting in the school hall.", daysFromNow: 5, durationHours: 2, notifyAudience: "PARENTS" },
    { title: "Staff development day", description: "In-service training for teaching staff.", daysFromNow: 14, durationHours: 6, notifyAudience: "STAFF" },
    { title: "Inter-house sports", description: "Annual inter-house sports competition.", daysFromNow: 21, durationHours: 5, notifyAudience: "BOTH" },
    { title: "Resumption for next term", description: "Students resume for the new term.", daysFromNow: -30, durationHours: 8, notifyAudience: "BOTH" },
    { title: "First term examinations", description: "End-of-term examinations begin.", daysFromNow: -14, durationHours: 40, termId: currentTerm.id, notifyAudience: "PARENTS" },
  ];
  for (const e of calendarEventSeeds) {
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + e.daysFromNow);
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + e.durationHours);
    await prisma.calendarEvent.create({
      data: {
        schoolId: school.id,
        title: e.title,
        description: e.description,
        startAt,
        endAt,
        classArmId: e.classArmId ?? null,
        termId: e.termId ?? currentTerm.id,
        sessionId: session.id,
        notifyAudience: e.notifyAudience ?? null,
        createdById: admin.id,
      },
    });
  }

  const feedbackSeeds: { user: { id: string }; message: string; reviewed: boolean }[] = [
    { user: parentUser, message: "Could the school consider extending the aftercare programme to 6pm? Pickup at 5pm is tight for working parents.", reviewed: true },
    { user: studentUser, message: "The library could use more storybooks for younger pupils.", reviewed: false },
    { user: teacher1, message: "Suggestion: a shared supply cupboard for Nursery and Primary 1 classrooms would save time between lessons.", reviewed: false },
    { user: parentUser, message: "Thank you to the staff for organising the excursion — the children really enjoyed it!", reviewed: true },
  ];
  for (const f of feedbackSeeds) {
    await prisma.feedback.create({
      data: {
        schoolId: school.id,
        submittedById: f.user.id,
        message: f.message,
        status: f.reviewed ? "REVIEWED" : "NEW",
        reviewedById: f.reviewed ? admin.id : null,
        reviewedAt: f.reviewed ? new Date() : null,
      },
    });
  }

  // Admission pipeline — applicants at every stage, so the "Applicants"
  // list has something real to filter and the ENROLLED example shows the
  // Full Admission Process having already run for one of them.
  const applicantSeeds: {
    childFirstName: string; childLastName: string; parentName: string; parentEmail: string; parentPhone: string;
    status: "APPLIED" | "UNDER_REVIEW" | "OFFERED" | "ACCEPTED" | "REJECTED" | "ENROLLED";
    feeStatus: "UNPAID" | "PENDING_CONFIRMATION" | "PAID";
    desiredClassGroupId: string;
  }[] = [
    { childFirstName: "Chidera", childLastName: "Nnamdi", parentName: "Kene Nnamdi", parentEmail: "kene.nnamdi@example.com", parentPhone: "+234 803 111 2200", status: "APPLIED", feeStatus: "UNPAID", desiredClassGroupId: classGroups[0].id },
    { childFirstName: "Sarah", childLastName: "Bello", parentName: "Musa Bello", parentEmail: "musa.bello@example.com", parentPhone: "+234 805 222 3300", status: "UNDER_REVIEW", feeStatus: "PENDING_CONFIRMATION", desiredClassGroupId: classGroups[1].id },
    { childFirstName: "David", childLastName: "Okafor", parentName: "Ijeoma Okafor", parentEmail: "ijeoma.okafor@example.com", parentPhone: "+234 806 333 4400", status: "OFFERED", feeStatus: "PAID", desiredClassGroupId: classGroups[2].id },
    { childFirstName: "Zara", childLastName: "Aliyu", parentName: "Fatima Aliyu", parentEmail: "fatima.aliyu@example.com", parentPhone: "+234 807 444 5500", status: "ACCEPTED", feeStatus: "PAID", desiredClassGroupId: classGroups[3].id },
    { childFirstName: "Michael", childLastName: "Eze", parentName: "Grace Eze", parentEmail: "grace.eze@example.com", parentPhone: "+234 808 555 6600", status: "REJECTED", feeStatus: "PAID", desiredClassGroupId: classGroups[4].id },
  ];
  for (const a of applicantSeeds) {
    await prisma.applicant.create({
      data: {
        schoolId: school.id,
        childFirstName: a.childFirstName,
        childLastName: a.childLastName,
        gender: Math.random() > 0.5 ? "MALE" : "FEMALE",
        desiredClassGroupId: a.desiredClassGroupId,
        parentName: a.parentName,
        parentEmail: a.parentEmail,
        parentPhone: a.parentPhone,
        status: a.status,
        admissionFeeMinor: 1_500_00,
        feeStatus: a.feeStatus,
        feePaidAt: a.feeStatus === "PAID" ? new Date() : null,
        reviewedById: a.status === "APPLIED" ? null : admin.id,
      },
    });
  }
  // One already-completed application, linked to a real seeded student, so
  // the "Enrolled" filter and the applicant detail page's admitted-state
  // both have a genuine example to show.
  const admittedStudent = enrolledStudents[enrolledStudents.length - 1];
  await prisma.applicant.create({
    data: {
      schoolId: school.id,
      childFirstName: "Precious",
      childLastName: "Adeyemi",
      gender: "FEMALE",
      desiredClassGroupId: classGroups[0].id,
      parentName: "Tolu Adeyemi",
      parentEmail: "tolu.adeyemi@example.com",
      parentPhone: "+234 809 666 7700",
      status: "ENROLLED",
      admissionFeeMinor: 1_500_00,
      feeStatus: "PAID",
      feePaidAt: new Date(),
      reviewedById: admin.id,
      enrolledStudentId: admittedStudent.id,
    },
  });

  console.log("Setting up branding and a sample connected payment gateway...");

  // A visibly different color than globals.css's default Winfield blue,
  // so the branding feature is obviously live rather than a no-op.
  await prisma.school.update({ where: { id: school.id }, data: { brandColor: "#0f766e" } });

  // Mirrors encryptSecret() in src/lib/crypto.ts — duplicated here for the
  // same import "server-only" reason as everything else in this script
  // (confirmed: that import throws under tsx, not just under webpack).
  function seedEncryptSecret(plainText: string): string {
    const secret = process.env.PAYMENT_KEYS_SECRET || process.env.AUTH_SECRET || "insecure-dev-only-seed-key";
    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
  }

  // A connected-but-not-active example, so Settings has something real to
  // show — School.activePaymentProvider is deliberately left null, so
  // "Pay online" keeps using the safe simulated gateway rather than
  // trying (and failing) to call Paystack with a fake demo key.
  await prisma.paymentGatewayCredential.create({
    data: {
      schoolId: school.id,
      provider: "PAYSTACK",
      publicKey: "pk_test_demo_00000000000000000000000000",
      secretKeyEnc: seedEncryptSecret("sk_test_demo_00000000000000000000000000"),
      isEnabled: true,
    },
  });

  console.log("Setting up platform billing (Super Admin, plans, subscriptions)...");

  // Mirrors ensureDefaultPlans() in src/lib/platform-provisioning.ts —
  // upserted directly here (rather than imported) for the same import
  // "server-only" reason as everything else in this script; PLAN_CATALOG
  // itself carries no server-only dependency, so it's imported as-is
  // rather than re-typed, keeping this the single source of truth.
  const plans = await Promise.all(
    PLAN_TIERS.map((tier) => {
      const entry = PLAN_CATALOG[tier];
      return prisma.subscriptionPlan.upsert({
        where: { slug: entry.slug },
        create: {
          slug: entry.slug,
          name: entry.name,
          tagline: entry.tagline,
          priceMonthlyMinor: entry.priceMonthlyMinor,
          priceAnnualMinor: entry.priceAnnualMinor,
          currency: entry.currency,
          isCustomPricing: entry.isCustomPricing,
          studentLimit: entry.studentLimit,
          cbtActiveExamLimit: entry.cbtActiveExamLimit,
          cbtQuestionBankLimit: entry.cbtQuestionBankLimit,
          cbtAiQuestionsPerMonthLimit: entry.cbtAiQuestionsPerMonthLimit,
          cbtCandidateLimit: entry.cbtCandidateLimit,
          isMostPopular: entry.isMostPopular,
          sortOrder: entry.sortOrder,
          features: entry.features as Prisma.InputJsonValue,
        },
        update: {},
      });
    })
  );
  const professionalPlan = plans.find((p) => p.slug === "PROFESSIONAL")!;
  const starterPlan = plans.find((p) => p.slug === "STARTER")!;

  const currentPeriodStart = new Date();
  currentPeriodStart.setDate(1);
  const currentPeriodEnd = new Date(currentPeriodStart);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  // The main demo school: an established, paying customer on Professional.
  const subscription = await prisma.subscription.create({
    data: {
      schoolId: school.id,
      planId: professionalPlan.id,
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodStart,
      currentPeriodEnd,
    },
  });

  // Two prior months, paid; the current month still pending.
  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    const periodStart = new Date(currentPeriodStart);
    periodStart.setMonth(periodStart.getMonth() - monthsAgo);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const isPast = monthsAgo > 0;

    await prisma.platformInvoice.create({
      data: {
        schoolId: school.id,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        amountMinor: professionalPlan.priceMonthlyMinor!,
        currency: professionalPlan.currency,
        billingInterval: "MONTHLY",
        dueDate: periodEnd,
        status: isPast ? "PAID" : "PENDING",
        paidAt: isPast ? periodEnd : null,
      },
    });
  }

  // A ready-to-take CBT practice exam for the demo student (CBT Phase 10) —
  // built with raw Prisma calls, not the cbt-exams.ts/cbt-questions.ts
  // service functions, since those import "server-only" and this script
  // runs standalone under tsx. isPractice: true means a retake never
  // touches the gradebook (finalizeAttemptScore's own early return), so a
  // curious demo student can attempt it more than once with no side
  // effects on their real assessment record.
  console.log("Seeding a CBT practice exam...");
  const cbtExamType = await prisma.cBTExamTypeOption.upsert({
    where: { schoolId_key: { schoolId: school.id, key: "QUIZ" } },
    create: { schoolId: school.id, key: "QUIZ", label: "Quiz", isSystem: true },
    update: {},
  });

  function randomInt(min: number, max: number) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  const practiceQuestionIds: string[] = [];
  for (let i = 0; i < 14; i++) {
    const a = randomInt(2, 50);
    const b = randomInt(2, 50);
    const op = pick(["+", "-", "×"] as const);
    const correct = op === "+" ? a + b : op === "-" ? a - b : a * b;
    const distractors = new Set<number>([correct + randomInt(1, 5), Math.max(0, correct - randomInt(1, 5)), correct + randomInt(6, 12)]);
    distractors.delete(correct);
    const options = shuffleArray([
      { text: String(correct), isCorrect: true },
      ...[...distractors].slice(0, 3).map((n) => ({ text: String(n), isCorrect: false })),
    ]);
    const question = await prisma.cBTQuestion.create({
      data: {
        schoolId: school.id,
        subjectId: numeracy.id,
        type: "MULTIPLE_CHOICE",
        status: "APPROVED",
        source: "MANUAL",
        difficulty: "EASY",
        topic: op === "+" ? "Addition" : op === "-" ? "Subtraction" : "Multiplication",
        prompt: `What is ${a} ${op} ${b}?`,
        marks: 1,
        explanation: `${a} ${op} ${b} = ${correct}.`,
        createdById: teacher1.id,
        approvedById: teacher1.id,
        approvedAt: new Date(),
        options: { create: options.map((o, idx) => ({ text: o.text, isCorrect: o.isCorrect, order: idx })) },
      },
    });
    practiceQuestionIds.push(question.id);
  }

  const trueFalseFacts: { statement: string; isTrue: boolean; topic: string }[] = [
    { statement: "An even number is always divisible by 2.", isTrue: true, topic: "Number properties" },
    { statement: "Zero is a positive number.", isTrue: false, topic: "Number properties" },
    { statement: "A triangle has four sides.", isTrue: false, topic: "Shapes" },
  ];
  for (const fact of trueFalseFacts) {
    const question = await prisma.cBTQuestion.create({
      data: {
        schoolId: school.id,
        subjectId: numeracy.id,
        type: "TRUE_FALSE",
        status: "APPROVED",
        source: "MANUAL",
        difficulty: "EASY",
        topic: fact.topic,
        prompt: fact.statement,
        marks: 1,
        createdById: teacher1.id,
        approvedById: teacher1.id,
        approvedAt: new Date(),
        options: {
          create: [
            { text: "True", isCorrect: fact.isTrue, order: 0 },
            { text: "False", isCorrect: !fact.isTrue, order: 1 },
          ],
        },
      },
    });
    practiceQuestionIds.push(question.id);
  }

  const shortAnswers: { prompt: string; answers: string[]; topic: string }[] = [
    { prompt: "How many days are there in a week?", answers: ["7", "seven"], topic: "General knowledge" },
    { prompt: "What is the next number after 99?", answers: ["100", "one hundred"], topic: "Counting" },
    { prompt: "How many sides does a square have?", answers: ["4", "four"], topic: "Shapes" },
  ];
  for (const sa of shortAnswers) {
    const question = await prisma.cBTQuestion.create({
      data: {
        schoolId: school.id,
        subjectId: numeracy.id,
        type: "SHORT_ANSWER",
        status: "APPROVED",
        source: "MANUAL",
        difficulty: "EASY",
        topic: sa.topic,
        prompt: sa.prompt,
        marks: 1,
        acceptedAnswers: sa.answers,
        createdById: teacher1.id,
        approvedById: teacher1.id,
        approvedAt: new Date(),
      },
    });
    practiceQuestionIds.push(question.id);
  }

  const practiceStartAt = new Date();
  practiceStartAt.setDate(practiceStartAt.getDate() - 1); // already open
  const practiceEndAt = new Date();
  practiceEndAt.setDate(practiceEndAt.getDate() + 90); // generous window for a demo

  const practiceExam = await prisma.cBTExam.create({
    data: {
      schoolId: school.id,
      title: "Numeracy Practice Test",
      examTypeId: cbtExamType.id,
      subjectId: numeracy.id,
      termId: currentTerm.id,
      instructions: "A short, ungraded practice test — retake it as many times as you like. Your score never affects your official results.",
      isPractice: true,
      status: "PUBLISHED",
      publishedAt: new Date(),
      publishedById: teacher1.id,
      questionSelectionMode: "MANUAL",
      totalMarks: practiceQuestionIds.length,
      startAt: practiceStartAt,
      endAt: practiceEndAt,
      durationMinutes: 30,
      requireFullscreen: false,
      detectTabSwitch: true,
      restrictCopyPaste: false,
      restrictRightClick: false,
      maxAttempts: 3,
      autoSubmitOnExpiry: true,
      desktopOnly: false,
      resultVisibility: "IMMEDIATE",
      showCorrectAnswers: true,
      showExplanations: true,
      showRanking: false,
      createdById: teacher1.id,
      examQuestions: { create: practiceQuestionIds.map((questionId, order) => ({ questionId, order })) },
    },
  });

  const practiceCandidates = await prisma.student.findMany({
    where: { schoolId: school.id, classArmId: demoClassArmId!, status: "ACTIVE" },
    select: { id: true },
  });
  await prisma.cBTExamCandidate.createMany({
    data: practiceCandidates.map((s) => ({ examId: practiceExam.id, studentId: s.id, schoolId: school.id })),
    skipDuplicates: true,
  });

  // Online Learning demo content — teacher1 already teaches Numeracy in
  // every class arm (see the teacherAssignment seeding above), so a
  // lecture/live class targeting the demo student's own class arm is
  // guaranteed to satisfy assertTeacherAssignment the same way a real
  // teacher's would.
  console.log("Seeding online learning demo lecture and live class...");
  const demoLecture = await prisma.lecture.create({
    data: {
      schoolId: school.id,
      teacherId: teacher1.id,
      subjectId: numeracy.id,
      classArmId: demoClassArmId!,
      academicSessionId: session.id,
      termId: currentTerm.id,
      title: "Introduction to Counting and Numbers",
      topic: "Numbers 1-20",
      description: "A gentle introduction to counting, recognizing and writing numbers from 1 to 20.",
      learningObjectives: "By the end of this lesson, pupils should be able to count to 20 and recognize written numerals.",
      instructions: "Read through the lesson, then try the practice questions attached below.",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  await prisma.lectureResource.createMany({
    data: [
      {
        lectureId: demoLecture.id,
        type: "WRITTEN",
        title: "Counting from 1 to 20",
        order: 0,
        writtenContent:
          "Numbers help us count things around us. Let's practice counting from 1 to 20.\n\n1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20.\n\nTry counting your fingers, your toys, or the chairs in your classroom!",
      },
      {
        lectureId: demoLecture.id,
        type: "EXTERNAL_LINK",
        title: "Extra practice: Counting song (external resource)",
        order: 1,
        externalUrl: "https://www.khanacademy.org/kids",
      },
    ],
  });

  const liveClassStart = new Date();
  liveClassStart.setDate(liveClassStart.getDate() + 2);
  liveClassStart.setHours(10, 0, 0, 0);
  const demoLiveClass = await prisma.liveClass.create({
    data: {
      schoolId: school.id,
      teacherId: teacher1.id,
      subjectId: numeracy.id,
      classArmId: demoClassArmId!,
      academicSessionId: session.id,
      termId: currentTerm.id,
      title: "Numbers Live Revision",
      topic: "Counting and number recognition",
      description: "A live revision class going over counting from 1 to 20 with real-time Q&A.",
      scheduledStart: liveClassStart,
      durationMinutes: 40,
      joinWindowMinutesBefore: 15,
      status: "SCHEDULED",
      roomName: `live-${crypto.randomUUID()}`,
    },
  });
  const demoLiveClassRoster = await prisma.student.findMany({
    where: { schoolId: school.id, classArmId: demoClassArmId!, status: "ACTIVE" },
    select: { id: true },
  });
  await prisma.liveClassAttendance.createMany({
    data: demoLiveClassRoster.map((s) => ({ schoolId: school.id, liveClassId: demoLiveClass.id, studentId: s.id })),
    skipDuplicates: true,
  });

  let superAdminRole = await prisma.role.findFirst({ where: { schoolId: null, key: "SUPER_ADMIN" } });
  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: { schoolId: null, key: "SUPER_ADMIN", name: "Super Admin", isSystem: true },
    });
  }
  await prisma.user.upsert({
    where: { email: "superadmin@winfield.demo" },
    create: { schoolId: null, roleId: superAdminRole.id, email: "superadmin@winfield.demo", name: "Winfield Platform Admin", passwordHash },
    update: {},
  });

  // A second, smaller demo school — a brand-new signup still inside its
  // 14-day trial on Starter, so the platform admin/billing dashboards and
  // the trial banner both have a real second tenant to show, distinct from
  // Winfield's own paid-and-established Professional subscription above.
  console.log("Seeding second demo school (trial)...");
  const trialSchoolName = "Bright Path Academy";
  const trialSlug = slugify(trialSchoolName);
  await prisma.school.deleteMany({ where: { slug: trialSlug } });

  const trialSchool = await prisma.school.create({
    data: {
      name: trialSchoolName,
      slug: trialSlug,
      status: "TRIAL",
      email: "info@brightpath.demo",
      city: "Abuja",
      state: "FCT",
      country: "Nigeria",
      currency: "NGN",
      timezone: "Africa/Lagos",
      schoolInfoCompletedAt: new Date(),
      onboardingCompletedAt: new Date(),
    },
  });

  const trialRoles = await Promise.all(
    SYSTEM_ROLE_KEYS.map((key) =>
      prisma.role.create({ data: { schoolId: trialSchool.id, key, name: SYSTEM_ROLE_LABELS[key], isSystem: true } })
    )
  );
  const trialRoleByKey = new Map(trialRoles.map((r) => [r.key, r]));
  await prisma.rolePermission.createMany({
    data: SYSTEM_ROLE_KEYS.flatMap((key) => {
      const role = trialRoleByKey.get(key)!;
      return ROLE_DEFAULT_PERMISSIONS[key]
        .map((permKey) => permissionByKey.get(permKey))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));
    }),
  });

  const trialOwner = await prisma.user.create({
    data: {
      schoolId: trialSchool.id,
      roleId: trialRoleByKey.get("SCHOOL_OWNER")!.id,
      email: "owner@brightpath.demo",
      name: "Bright Path Owner",
      passwordHash,
    },
  });

  const trialStart = new Date();
  trialStart.setDate(trialStart.getDate() - 3);
  const trialEnd = new Date(trialStart);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_PERIOD_DAYS);

  await prisma.subscription.create({
    data: {
      schoolId: trialSchool.id,
      planId: starterPlan.id,
      status: "TRIALING",
      billingInterval: "MONTHLY",
      trialStart,
      trialEnd,
      currentPeriodStart: trialStart,
      currentPeriodEnd: trialEnd,
    },
  });

  console.log(`\nSeeded "${schoolName}" with ${classArms.length} class arms and 110 students.`);
  console.log(`All staff accounts use the password: ${DEMO_PASSWORD}\n`);
  for (const s of staffSeeds) console.log(`  ${s.role.padEnd(16)} ${s.email}`);
  console.log(`\nPortal demo accounts (same password: ${DEMO_PASSWORD}):`);
  console.log(`  PARENT           ${parentUser.email}`);
  console.log(`  STUDENT          ${studentUser.email}`);
  console.log(`\nA "Numeracy Practice Test" CBT exam is live and ready — log in as the student above and visit /portal/student/cbt.`);
  console.log(`\nPlatform admin (same password: ${DEMO_PASSWORD}):`);
  console.log(`  SUPER_ADMIN      superadmin@winfield.demo`);
  console.log(`\nSecond demo school "${trialSchoolName}" (Starter plan, 14-day trial, same password: ${DEMO_PASSWORD}):`);
  console.log(`  SCHOOL_OWNER     ${trialOwner.email}`);
  console.log(`\nPre-School Results demo: class "Nursery 1" (assessmentMode=MILESTONE), subject "English Language", student "Abayo Adewale" (${abayoAdmissionNumber}) with 4 example milestone assessments. Visit /dashboard/results/preschool.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
