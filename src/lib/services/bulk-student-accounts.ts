import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSchoolEmail, absoluteUrl } from "@/lib/notification-delivery/send-email";
import { sendSchoolSms } from "@/lib/notification-delivery/send-sms";
import { logAudit } from "@/lib/audit";

export type BulkPasswordMedium = "email" | "sms";

export interface BulkPasswordResultRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: "sent" | "already_has_account" | "no_guardian_contact" | "send_failed";
  guardianContact?: string;
  /// The plaintext password — present only for "sent"/"send_failed" (never
  /// stored anywhere after this call returns), so a failed send still lets
  /// the admin hand it over some other way instead of it being lost.
  password?: string;
  error?: string;
}

function generateStudentPassword(): string {
  // 16 hex chars from 8 random bytes, same as convertInquiryToBuyer's
  // temporary password — well above this app's 8-char minimum.
  return crypto.randomBytes(8).toString("hex");
}

function placeholderLogin(): string {
  return `student-${crypto.randomBytes(12).toString("hex")}@portal.internal`;
}

/// Creates a real, immediately usable student portal login directly — no
/// invite link or acceptance step — for a student who was bulk-imported
/// and never individually invited. Returns the plaintext password, or null
/// if the student already has an account: this provisions new accounts,
/// it never resets an existing one.
async function createStudentPortalAccountDirect(schoolId: string, studentId: string): Promise<string | null> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw new Error("Student not found.");
  if (student.userId) return null;

  const role = await prisma.role.findFirst({ where: { schoolId, key: "STUDENT" } });
  if (!role) throw new Error("Student role is not set up for this school.");

  const password = generateStudentPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId,
        roleId: role.id,
        email: placeholderLogin(),
        passwordHash,
        name: `${student.firstName} ${student.lastName}`,
      },
    });
    await tx.student.update({ where: { id: studentId }, data: { userId: user.id } });
  });

  return password;
}

/// A student has no email/phone of their own — credentials go to their
/// guardian(s): whoever is marked primary, or every linked guardian if
/// none is. Guardians with no usable contact for the chosen medium (e.g.
/// no email on file) are filtered out rather than failing the whole send.
async function guardianContactsForStudent(studentId: string, medium: BulkPasswordMedium) {
  const links = await prisma.studentGuardian.findMany({ where: { studentId }, include: { guardian: true } });
  if (links.length === 0) return [];

  const primary = links.filter((l) => l.isPrimary);
  const targets = primary.length > 0 ? primary : links;

  return targets
    .map((l) => ({
      name: `${l.guardian.firstName} ${l.guardian.lastName}`,
      contact: medium === "email" ? l.guardian.email : l.guardian.phone,
    }))
    .filter((t): t is { name: string; contact: string } => Boolean(t.contact));
}

/// Bulk-provisions student portal logins for a set of already-enrolled
/// students (typically ones brought in through a CSV import that never
/// went through the one-by-one invite flow) and hands the generated
/// password to their guardian(s) by email or SMS, so the guardian can then
/// use the "view as" button on their own portal to check in on the child's
/// portal without a login of their own. Students that already have an
/// account, or have no guardian reachable by the chosen medium, are
/// reported back rather than silently dropped.
export async function bulkGenerateStudentPasswords(
  schoolId: string,
  actingUserId: string,
  studentIds: string[],
  medium: BulkPasswordMedium
): Promise<BulkPasswordResultRow[]> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, slug: true } });

  const students = await prisma.student.findMany({
    where: { schoolId, id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, userId: true },
  });

  const loginUrl = absoluteUrl("/login");
  const results: BulkPasswordResultRow[] = [];

  for (const student of students) {
    const studentName = `${student.firstName} ${student.lastName}`;

    if (student.userId) {
      results.push({ studentId: student.id, studentName, admissionNumber: student.admissionNumber, status: "already_has_account" });
      continue;
    }

    const contacts = await guardianContactsForStudent(student.id, medium);
    if (contacts.length === 0) {
      results.push({ studentId: student.id, studentName, admissionNumber: student.admissionNumber, status: "no_guardian_contact" });
      continue;
    }

    const password = await createStudentPortalAccountDirect(schoolId, student.id);
    if (!password) {
      results.push({ studentId: student.id, studentName, admissionNumber: student.admissionNumber, status: "already_has_account" });
      continue;
    }

    const message = `${studentName}'s ${school.name} student portal is ready. School: ${school.slug} · Admission No.: ${student.admissionNumber} · Password: ${password}. Log in at ${loginUrl} using the "Student login" tab.`;

    let sendError: string | undefined;
    for (const contact of contacts) {
      const outcome =
        medium === "email"
          ? await sendSchoolEmail(schoolId, {
              to: contact.contact,
              subject: `${studentName}'s student portal is ready`,
              title: "Student portal access is ready",
              body: `Hello ${contact.name}, ${message}`,
            })
          : await sendSchoolSms(schoolId, contact.contact, message);
      if (!outcome.sent) sendError = outcome.error;
    }

    results.push({
      studentId: student.id,
      studentName,
      admissionNumber: student.admissionNumber,
      status: sendError ? "send_failed" : "sent",
      guardianContact: contacts.map((c) => c.contact).join(", "),
      password,
      error: sendError,
    });
  }

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "BULK_GENERATE_STUDENT_PASSWORDS",
    resourceType: "Student",
    newValue: { medium, requested: studentIds.length, sent: results.filter((r) => r.status === "sent").length },
  });

  return results;
}
