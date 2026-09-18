import "server-only";
import { prisma } from "@/lib/db";
import { parseCsvRecords } from "@/lib/csv";
import { createStudent, type StudentInput } from "@/lib/services/students";
import { StudentLimitError } from "@/lib/billing/entitlements";
import { Prisma } from "@/generated/prisma/client";
import type { Gender, GuardianRelationship } from "@/generated/prisma/client";

// ---------------------------------------------------------------------
// CSV import (preview-then-confirm) — for a school migrating its existing
// roster in. Template columns (header row required, any order):
//   admissionNumber (optional — auto-generated if blank), firstName,
//   lastName, otherNames, gender (MALE/FEMALE, optional), dateOfBirth
//   (YYYY-MM-DD, optional), className (must match an existing class —
//   e.g. "Primary 1 A" — optional, leaves the student unassigned), address,
//   city, state, bloodGroup, emergencyContact, allergies, medicalNotes,
//   guardianFirstName, guardianLastName, guardianPhone, guardianEmail,
//   guardianRelationship (FATHER/MOTHER/GUARDIAN/OTHER)
// A row's guardian columns are only used if firstName+lastName+phone are
// all present — a partial guardian is treated the same as no guardian
// (matches the single-student enrollment form's own rule).
// ---------------------------------------------------------------------

export interface StudentImportRowResult {
  rowNumber: number;
  data: StudentInput | null;
  raw: Record<string, string>;
  errors: string[];
}

const GENDERS = new Set(["MALE", "FEMALE"]);
const RELATIONSHIPS = new Set(["FATHER", "MOTHER", "GUARDIAN", "OTHER"]);

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function parseStudentImportCsv(
  schoolId: string,
  csvText: string
): Promise<{ rows: StudentImportRowResult[]; validCount: number }> {
  const { records } = parseCsvRecords(csvText);
  if (records.length === 0) return { rows: [], validCount: 0 };

  const classArms = await prisma.classArm.findMany({ where: { schoolId }, include: { classGroup: true } });
  const classArmByLabel = new Map(classArms.map((arm) => [`${arm.classGroup.name} ${arm.name}`.toLowerCase(), arm]));

  // Admission numbers given in the file must also be unique against each
  // other, not just against the DB — a duplicate later in the same file
  // would otherwise silently overwrite nothing (createStudent always
  // inserts) and fail confusingly at the DB constraint instead.
  const seenAdmissionNumbers = new Set<string>();

  const rows: StudentImportRowResult[] = [];
  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const errors: string[] = [];

    const firstName = raw.firstname?.trim();
    if (!firstName) errors.push("First name is required.");
    const lastName = raw.lastname?.trim();
    if (!lastName) errors.push("Last name is required.");

    const admissionNumber = raw.admissionnumber?.trim() || undefined;
    if (admissionNumber) {
      const key = admissionNumber.toLowerCase();
      if (seenAdmissionNumbers.has(key)) errors.push(`Admission number "${admissionNumber}" is repeated earlier in this file.`);
      seenAdmissionNumbers.add(key);
    }

    const genderRaw = raw.gender?.trim().toUpperCase();
    if (genderRaw && !GENDERS.has(genderRaw)) errors.push("Gender must be MALE or FEMALE (or left blank).");

    const dateOfBirthRaw = raw.dateofbirth?.trim() || "";
    const dateOfBirth = parseDate(dateOfBirthRaw);
    if (dateOfBirthRaw && !dateOfBirth) errors.push(`Date of birth "${dateOfBirthRaw}" is not a valid date (use YYYY-MM-DD).`);

    const classNameRaw = raw.classname?.trim() || "";
    const classArm = classNameRaw ? classArmByLabel.get(classNameRaw.toLowerCase()) : undefined;
    if (classNameRaw && !classArm) errors.push(`Unknown class "${classNameRaw}" — it must match an existing class exactly, e.g. "Primary 1 A".`);

    const guardianFirstName = raw.guardianfirstname?.trim();
    const guardianLastName = raw.guardianlastname?.trim();
    const guardianPhone = raw.guardianphone?.trim();
    const hasGuardian = Boolean(guardianFirstName && guardianLastName && guardianPhone);

    const guardianRelationshipRaw = raw.guardianrelationship?.trim().toUpperCase();
    if (hasGuardian && guardianRelationshipRaw && !RELATIONSHIPS.has(guardianRelationshipRaw)) {
      errors.push("Guardian relationship must be FATHER, MOTHER, GUARDIAN or OTHER.");
    }

    const data: StudentInput | null =
      errors.length === 0
        ? {
            admissionNumber,
            firstName: firstName!,
            lastName: lastName!,
            otherNames: raw.othernames?.trim() || null,
            gender: (genderRaw as Gender | undefined) ?? null,
            dateOfBirth,
            bloodGroup: raw.bloodgroup?.trim() || null,
            addressLine: raw.address?.trim() || null,
            city: raw.city?.trim() || null,
            state: raw.state?.trim() || null,
            medicalNotes: raw.medicalnotes?.trim() || null,
            allergies: raw.allergies?.trim() || null,
            emergencyContact: raw.emergencycontact?.trim() || null,
            classArmId: classArm?.id ?? null,
            guardian: hasGuardian
              ? {
                  firstName: guardianFirstName!,
                  lastName: guardianLastName!,
                  phone: guardianPhone!,
                  email: raw.guardianemail?.trim() || null,
                  relationship: (guardianRelationshipRaw as GuardianRelationship | undefined) || "GUARDIAN",
                }
              : null,
          }
        : null;

    rows.push({ rowNumber: i + 2, data, raw, errors });
  }

  return { rows, validCount: rows.filter((r) => r.data).length };
}

export interface StudentImportOutcome {
  created: number;
  failed: { rowNumber: number; name: string; error: string }[];
}

/// Rows are created one at a time (not a single transaction) so that a
/// billing limit hit partway through — or one bad row slipping past
/// preview, e.g. a class deleted between preview and confirm — stops that
/// row without discarding the students already imported ahead of it.
export async function commitStudentImport(
  schoolId: string,
  rows: { rowNumber: number; data: StudentInput }[]
): Promise<StudentImportOutcome> {
  const outcome: StudentImportOutcome = { created: 0, failed: [] };
  for (const row of rows) {
    try {
      await createStudent(schoolId, row.data);
      outcome.created++;
    } catch (error) {
      const message =
        error instanceof StudentLimitError
          ? "Your plan's student limit was reached — remaining rows were not imported."
          : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
            ? `Admission number "${row.data.admissionNumber}" is already in use.`
            : error instanceof Error
              ? error.message
              : "Could not import this row.";
      outcome.failed.push({ rowNumber: row.rowNumber, name: `${row.data.firstName} ${row.data.lastName}`, error: message });
    }
  }
  return outcome;
}
