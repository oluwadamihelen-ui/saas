import "server-only";
import { prisma } from "@/lib/db";
import { parseCsvRecords } from "@/lib/csv";

// ---------------------------------------------------------------------
// CSV import (preview-then-confirm) — for backfilling a term's scores in
// bulk, including past sessions/terms migrated from another system.
// Template columns (header row required, any order):
//   sessionName, termName, admissionNumber, subjectCode, componentName,
//   score
// One row per (student, subject, component) score. sessionName+termName
// together resolve the Term row (term names like "First Term" repeat
// across sessions, so both are required — unlike the score-entry grid,
// which only ever has one "current" term in view at a time).
// ---------------------------------------------------------------------

export interface ScoreImportEntry {
  studentId: string;
  subjectId: string;
  termId: string;
  componentId: string;
  value: number;
}

export interface ResultsImportRowResult {
  rowNumber: number;
  data: ScoreImportEntry | null;
  raw: Record<string, string>;
  /// Shown in the preview table so a school can tell rows apart at a
  /// glance without cross-referencing ids.
  summary: string;
  errors: string[];
}

export async function parseResultsImportCsv(
  schoolId: string,
  csvText: string
): Promise<{ rows: ResultsImportRowResult[]; validCount: number }> {
  const { records } = parseCsvRecords(csvText);
  if (records.length === 0) return { rows: [], validCount: 0 };

  const [terms, subjects, components, students] = await Promise.all([
    prisma.term.findMany({ where: { schoolId }, include: { academicSession: true } }),
    prisma.subject.findMany({ where: { schoolId } }),
    prisma.assessmentComponent.findMany({ where: { schoolId } }),
    prisma.student.findMany({ where: { schoolId }, select: { id: true, admissionNumber: true } }),
  ]);

  const termByKey = new Map(terms.map((t) => [`${t.academicSession.name}::${t.name}`.toLowerCase(), t]));
  const subjectByCode = new Map(subjects.map((s) => [s.code.toLowerCase(), s]));
  const componentByName = new Map(components.map((c) => [c.name.toLowerCase(), c]));
  const studentByAdmission = new Map(students.map((s) => [s.admissionNumber.toLowerCase(), s]));

  const rows: ResultsImportRowResult[] = [];
  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const errors: string[] = [];

    const admissionNumber = raw.admissionnumber?.trim() ?? "";
    const student = studentByAdmission.get(admissionNumber.toLowerCase());
    if (!admissionNumber) errors.push("Admission number is required.");
    else if (!student) errors.push(`No student found with admission number "${admissionNumber}".`);

    const sessionName = raw.sessionname?.trim() ?? "";
    const termName = raw.termname?.trim() ?? "";
    const term = termByKey.get(`${sessionName}::${termName}`.toLowerCase());
    if (!sessionName || !termName) errors.push("Session name and term name are both required.");
    else if (!term) errors.push(`No term "${termName}" found in session "${sessionName}".`);

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
        ? { studentId: student!.id, subjectId: subject!.id, termId: term!.id, componentId: component!.id, value }
        : null;

    const summary = `${admissionNumber || "?"} · ${subjectCode || "?"} · ${componentName || "?"} = ${scoreRaw || "?"}`;
    rows.push({ rowNumber: i + 2, data, raw, summary, errors });
  }

  return { rows, validCount: rows.filter((r) => r.data).length };
}

export async function commitResultsImport(
  schoolId: string,
  enteredById: string,
  entries: ScoreImportEntry[]
): Promise<{ imported: number }> {
  await prisma.$transaction(
    entries.map((e) =>
      prisma.score.upsert({
        where: { studentId_subjectId_termId_componentId: { studentId: e.studentId, subjectId: e.subjectId, termId: e.termId, componentId: e.componentId } },
        create: { schoolId, studentId: e.studentId, subjectId: e.subjectId, termId: e.termId, componentId: e.componentId, value: e.value, enteredById },
        update: { value: e.value, enteredById },
      })
    )
  );
  return { imported: entries.length };
}
