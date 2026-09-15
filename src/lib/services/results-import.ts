import "server-only";
import { prisma } from "@/lib/db";
import { parseCsvRecords } from "@/lib/csv";

// ---------------------------------------------------------------------
// CSV import (preview-then-confirm) — for backfilling a term's scores in
// bulk, including past sessions/terms migrated from another system.
// Template columns (header row required, any order):
//   sessionName, termName, className, admissionNumber, subjectCode,
//   componentName, score
// One row per (student, subject, component) score. sessionName+termName
// together resolve the Term row (term names like "First Term" repeat
// across sessions, so both are required — unlike the score-entry grid,
// which only ever has one "current" term in view at a time).
//
// className is optional but strongly recommended for historical data: if
// given, it must match an existing class exactly (same lookup the
// student importer uses) and is stored as the score's verified,
// school-stated historical class (Score.classArmId, source "IMPORTED").
// If omitted, the row still imports — a school migrating scores that
// don't care about historical class reporting shouldn't be blocked —
// but Score.classArmId is left null (never guessed from the student's
// current class) and the row carries a warning so the school can see,
// before confirming, exactly which rows will have no historical class on
// record.
// ---------------------------------------------------------------------

export interface ScoreImportEntry {
  studentId: string;
  subjectId: string;
  termId: string;
  academicSessionId: string;
  componentId: string;
  value: number;
  classArmId: string | null;
}

export interface ResultsImportRowResult {
  rowNumber: number;
  data: ScoreImportEntry | null;
  raw: Record<string, string>;
  /// Shown in the preview table so a school can tell rows apart at a
  /// glance without cross-referencing ids.
  summary: string;
  errors: string[];
  /// Non-blocking — a row with only warnings still imports. Used for
  /// "no class given, historical class will be unknown" rather than
  /// rejecting the row outright.
  warnings: string[];
}

export async function parseResultsImportCsv(
  schoolId: string,
  csvText: string
): Promise<{ rows: ResultsImportRowResult[]; validCount: number }> {
  const { records } = parseCsvRecords(csvText);
  if (records.length === 0) return { rows: [], validCount: 0 };

  const [terms, subjects, components, students, classArms] = await Promise.all([
    prisma.term.findMany({ where: { schoolId }, include: { academicSession: true } }),
    prisma.subject.findMany({ where: { schoolId } }),
    prisma.assessmentComponent.findMany({ where: { schoolId } }),
    prisma.student.findMany({ where: { schoolId }, select: { id: true, admissionNumber: true } }),
    prisma.classArm.findMany({ where: { schoolId }, include: { classGroup: true } }),
  ]);

  const termByKey = new Map(terms.map((t) => [`${t.academicSession.name}::${t.name}`.toLowerCase(), t]));
  const subjectByCode = new Map(subjects.map((s) => [s.code.toLowerCase(), s]));
  const componentByName = new Map(components.map((c) => [c.name.toLowerCase(), c]));
  const studentByAdmission = new Map(students.map((s) => [s.admissionNumber.toLowerCase(), s]));
  const classArmByLabel = new Map(classArms.map((arm) => [`${arm.classGroup.name} ${arm.name}`.toLowerCase(), arm]));

  const rows: ResultsImportRowResult[] = [];
  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const errors: string[] = [];
    const warnings: string[] = [];

    const admissionNumber = raw.admissionnumber?.trim() ?? "";
    const student = studentByAdmission.get(admissionNumber.toLowerCase());
    if (!admissionNumber) errors.push("Admission number is required.");
    else if (!student) errors.push(`No student found with admission number "${admissionNumber}".`);

    const sessionName = raw.sessionname?.trim() ?? "";
    const termName = raw.termname?.trim() ?? "";
    const term = termByKey.get(`${sessionName}::${termName}`.toLowerCase());
    if (!sessionName || !termName) errors.push("Session name and term name are both required.");
    else if (!term) errors.push(`No term "${termName}" found in session "${sessionName}".`);

    const classNameRaw = raw.classname?.trim() ?? "";
    const classArm = classNameRaw ? classArmByLabel.get(classNameRaw.toLowerCase()) : undefined;
    if (classNameRaw && !classArm) {
      errors.push(`Unknown class "${classNameRaw}" — it must match an existing class exactly, e.g. "JSS 2 A".`);
    } else if (!classNameRaw) {
      warnings.push("No class given — this score will be saved without a verified historical class.");
    }

    const subjectCode = raw.subjectcode?.trim() ?? "";
    const subject = subjectByCode.get(subjectCode.toLowerCase());
    if (!subjectCode) errors.push("Subject code is required.");
    else if (!subject) errors.push(`Unknown subject code "${subjectCode}".`);

    const componentName = raw.componentname?.trim() ?? "";
    const component = componentByName.get(componentName.toLowerCase());
    if (!componentName) errors.push("Component name is required.");
    else if (!component) errors.push(`Unknown assessment component "${componentName}".`);

    const scoreRaw = raw.score?.trim() ?? "";
    const value = Number(scoreRaw);
    if (!scoreRaw || !Number.isFinite(value)) errors.push("Score must be a number.");
    else if (value < 0) errors.push("Score cannot be negative.");
    else if (component && value > component.maxScore) errors.push(`Score exceeds this component's maximum of ${component.maxScore}.`);

    const data: ScoreImportEntry | null =
      errors.length === 0
        ? {
            studentId: student!.id,
            subjectId: subject!.id,
            termId: term!.id,
            academicSessionId: term!.academicSessionId,
            componentId: component!.id,
            value,
            classArmId: classArm?.id ?? null,
          }
        : null;

    const classLabel = classNameRaw || (classArm ? `${classArm.classGroup.name} ${classArm.name}` : "no class");
    const summary = `${admissionNumber || "?"} · ${classLabel} · ${subjectCode || "?"} · ${componentName || "?"} = ${scoreRaw || "?"}`;
    rows.push({ rowNumber: i + 2, data, raw, summary, errors, warnings });
  }

  return { rows, validCount: rows.filter((r) => r.data).length };
}

export async function commitResultsImport(
  schoolId: string,
  enteredById: string,
  entries: ScoreImportEntry[]
): Promise<{ imported: number }> {
  // classArmId/classArmSource are set only when a Score row is first
  // created (source "IMPORTED") — never on an update, so re-importing a
  // file (e.g. to fix a score value) can never silently change a
  // previously-recorded historical class, the same rule live score entry
  // follows.
  await prisma.$transaction(
    entries.map((e) =>
      prisma.score.upsert({
        where: { studentId_subjectId_termId_componentId: { studentId: e.studentId, subjectId: e.subjectId, termId: e.termId, componentId: e.componentId } },
        create: {
          schoolId,
          studentId: e.studentId,
          subjectId: e.subjectId,
          termId: e.termId,
          componentId: e.componentId,
          value: e.value,
          enteredById,
          classArmId: e.classArmId,
          classArmSource: e.classArmId ? "IMPORTED" : null,
        },
        update: { value: e.value, enteredById },
      })
    )
  );

  // StudentClassHistory: one row per distinct (student, session, class)
  // actually stated by this import — deliberately not one per score row,
  // so importing e.g. five subjects for the same student/term doesn't
  // create five identical history rows. Deduped against rows this import
  // already created AND against whatever already exists in the table, so
  // re-running the same import twice doesn't duplicate history either.
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e.classArmId) continue;
    const key = `${e.studentId}::${e.academicSessionId}::${e.classArmId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existing = await prisma.studentClassHistory.findFirst({
      where: { schoolId, studentId: e.studentId, academicSessionId: e.academicSessionId, classArmId: e.classArmId },
    });
    if (existing) continue;

    await prisma.studentClassHistory.create({
      data: {
        schoolId,
        studentId: e.studentId,
        academicSessionId: e.academicSessionId,
        classArmId: e.classArmId,
        status: "ACTIVE",
        source: "IMPORTED",
      },
    });
  }

  return { imported: entries.length };
}
