import "server-only";
import { prisma } from "@/lib/db";
import { parseCsvRecords } from "@/lib/csv";
import { addGuardianToStudent } from "@/lib/services/students";
import type { GuardianRelationship } from "@/generated/prisma/client";

// ---------------------------------------------------------------------
// CSV import (preview-then-confirm) — the counterpart to student-import.ts
// for a roster that was already brought in (e.g. through a bulk CSV
// import, or migrated from a previous system) without guardian data, so
// there's now no guardian on file to invite to the parent portal or hand
// a "view as" grant to. Template columns (header row required, any
// order): admissionNumber, guardianFirstName, guardianLastName,
// guardianPhone, guardianEmail (optional), guardianRelationship
// (FATHER/MOTHER/GUARDIAN/OTHER, optional — defaults to GUARDIAN).
// One row per guardian: a student with two parents needs two rows with
// the same admissionNumber, which is expected and never flagged as a
// duplicate — unlike student-import.ts, this always creates a new
// Guardian record rather than reusing one (link-existing-guardian in the
// student detail page already covers the "same parent, another child"
// case one at a time).
// ---------------------------------------------------------------------

export interface GuardianImportRowResult {
  rowNumber: number;
  studentId: string | null;
  guardian: { firstName: string; lastName: string; phone: string; email: string | null; relationship: GuardianRelationship } | null;
  raw: Record<string, string>;
  errors: string[];
}

const RELATIONSHIPS = new Set(["FATHER", "MOTHER", "GUARDIAN", "OTHER"]);

export async function parseGuardianImportCsv(
  schoolId: string,
  csvText: string
): Promise<{ rows: GuardianImportRowResult[]; validCount: number }> {
  const { records } = parseCsvRecords(csvText);
  if (records.length === 0) return { rows: [], validCount: 0 };

  const admissionNumbers = [...new Set(records.map((r) => r.admissionnumber?.trim()).filter(Boolean))] as string[];
  const students = await prisma.student.findMany({
    where: { schoolId, admissionNumber: { in: admissionNumbers } },
    select: { id: true, admissionNumber: true, firstName: true, lastName: true },
  });
  const studentByAdmissionNumber = new Map(students.map((s) => [s.admissionNumber.toLowerCase(), s]));

  const rows: GuardianImportRowResult[] = [];
  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const errors: string[] = [];

    const admissionNumber = raw.admissionnumber?.trim();
    if (!admissionNumber) errors.push("Admission number is required.");
    const student = admissionNumber ? studentByAdmissionNumber.get(admissionNumber.toLowerCase()) : undefined;
    if (admissionNumber && !student) errors.push(`No student with admission number "${admissionNumber}" in this school.`);

    const firstName = raw.guardianfirstname?.trim();
    if (!firstName) errors.push("Guardian first name is required.");
    const lastName = raw.guardianlastname?.trim();
    if (!lastName) errors.push("Guardian last name is required.");
    const phone = raw.guardianphone?.trim();
    if (!phone) errors.push("Guardian phone is required.");

    const relationshipRaw = raw.guardianrelationship?.trim().toUpperCase();
    if (relationshipRaw && !RELATIONSHIPS.has(relationshipRaw)) {
      errors.push("Guardian relationship must be FATHER, MOTHER, GUARDIAN or OTHER (or left blank).");
    }

    const guardian =
      errors.length === 0
        ? {
            firstName: firstName!,
            lastName: lastName!,
            phone: phone!,
            email: raw.guardianemail?.trim() || null,
            relationship: (relationshipRaw as GuardianRelationship | undefined) || "GUARDIAN",
          }
        : null;

    rows.push({ rowNumber: i + 2, studentId: student?.id ?? null, guardian, raw, errors });
  }

  return { rows, validCount: rows.filter((r) => r.guardian && r.studentId).length };
}

export interface GuardianImportOutcome {
  created: number;
  failed: { rowNumber: number; name: string; error: string }[];
}

export async function commitGuardianImport(
  schoolId: string,
  rows: { rowNumber: number; studentId: string; guardian: { firstName: string; lastName: string; phone: string; email: string | null; relationship: GuardianRelationship } }[]
): Promise<GuardianImportOutcome> {
  const outcome: GuardianImportOutcome = { created: 0, failed: [] };
  for (const row of rows) {
    try {
      await addGuardianToStudent(schoolId, row.studentId, row.guardian);
      outcome.created++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add this guardian.";
      outcome.failed.push({ rowNumber: row.rowNumber, name: `${row.guardian.firstName} ${row.guardian.lastName}`, error: message });
    }
  }
  return outcome;
}
