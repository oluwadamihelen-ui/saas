import "server-only";
import { prisma } from "@/lib/db";
import { parseCsvLine, rowsToCsv } from "@/lib/csv";

/// Single source of truth for each importer's expected CSV shape, shared
/// between the import pages (which show it inline for reference) and the
/// Data Management hub's template downloads (which package it as a real
/// file) — kept here once rather than duplicated in both places.
export const STUDENT_IMPORT_TEMPLATE_HEADER =
  "admissionNumber,firstName,lastName,otherNames,gender,dateOfBirth,className,address,city,state,bloodGroup,emergencyContact,allergies,medicalNotes,guardianFirstName,guardianLastName,guardianPhone,guardianEmail,guardianRelationship";
export const STUDENT_IMPORT_TEMPLATE_EXAMPLE =
  '2023-0014,Amaka,Okafor,,FEMALE,2015-03-12,"Primary 4 A","12 Ikorodu Road",Lagos,Lagos,O+,08012345678,None,,Chidi,Okafor,08087654321,chidi.okafor@example.com,FATHER';

export const RESULTS_IMPORT_TEMPLATE_HEADER = "sessionName,termName,className,admissionNumber,subjectCode,componentName,score";
export const RESULTS_IMPORT_TEMPLATE_EXAMPLE = '2025/2026,First Term,"JSS 2 A",2023-0014,MTH,CA1,18';

export const CBT_IMPORT_TEMPLATE_HEADER =
  "subjectcode,type,difficulty,topic,prompt,marks,option1,option1correct,option2,option2correct,option3,option3correct,option4,option4correct,explanation";
export const CBT_IMPORT_TEMPLATE_EXAMPLE =
  'MTH,MULTIPLE_CHOICE,EASY,Fractions,"What is 1/2 + 1/4?",1,1/4,false,3/4,true,1/2,false,1,false,"Add the fractions using a common denominator."';

/// Matches the raw row keys lib/services/staff-import.ts's shared
/// validator expects — the same keys whether a row came from this CSV
/// shape or the bulk registration page's manual-entry table.
export const STAFF_IMPORT_TEMPLATE_HEADER = "name,email,role,phone,staffid,jobtitle,department";
export const STAFF_IMPORT_TEMPLATE_EXAMPLE = 'John Ade,john.ade@example.com,Teacher,08012345678,STAFF-014,Class Teacher,Sciences';

/// Re-parses each raw example-row string above (the same text shown inline
/// on the import pages) back into fields, then re-serializes through
/// rowsToCsv — so quoting stays correct without a second hand-written
/// escaper, and an extra, real-data example row can be appended alongside it.
function templateCsv(headerLine: string, exampleLines: string[], extraRow?: string[]): string {
  const header = headerLine.split(",");
  const rows = exampleLines.map((line) => parseCsvLine(line));
  if (extraRow) rows.push(extraRow);
  return rowsToCsv(header, rows);
}

/// Builds the students template with a second, context-aware example row
/// using one of the school's own class names when it has any set up —
/// purely illustrative, no real student data is ever included in a
/// template (it's a blank form to fill in, not an export).
export async function buildStudentsTemplateCsv(schoolId: string): Promise<string> {
  const classArm = await prisma.classArm.findFirst({ where: { schoolId }, include: { classGroup: true }, orderBy: { name: "asc" } });
  const extraRow = classArm
    ? ["", "Tunde", "Bello", "", "MALE", "2016-07-21", `${classArm.classGroup.name} ${classArm.name}`, "", "", "", "", "", "", "", "", "", "", "", ""]
    : undefined;
  return templateCsv(STUDENT_IMPORT_TEMPLATE_HEADER, [STUDENT_IMPORT_TEMPLATE_EXAMPLE], extraRow);
}

/// Same idea for results — when the school already has a term, class arm,
/// subject and assessment component set up, the second row uses those
/// real (but non-personal) names so the file matches this school's actual
/// setup, not just a generic example.
export async function buildResultsTemplateCsv(schoolId: string): Promise<string> {
  const [term, classArm, subject, component] = await Promise.all([
    prisma.term.findFirst({ where: { schoolId }, include: { academicSession: true }, orderBy: { startDate: "desc" } }),
    prisma.classArm.findFirst({ where: { schoolId }, include: { classGroup: true }, orderBy: { name: "asc" } }),
    prisma.subject.findFirst({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.assessmentComponent.findFirst({ where: { schoolId }, orderBy: { order: "asc" } }),
  ]);
  const extraRow =
    term && classArm && subject && component
      ? [term.academicSession.name, term.name, `${classArm.classGroup.name} ${classArm.name}`, "2023-0014", subject.code, component.name, "0"]
      : undefined;
  return templateCsv(RESULTS_IMPORT_TEMPLATE_HEADER, [RESULTS_IMPORT_TEMPLATE_EXAMPLE], extraRow);
}

export async function buildCbtQuestionsTemplateCsv(schoolId: string): Promise<string> {
  const subject = await prisma.subject.findFirst({ where: { schoolId }, orderBy: { name: "asc" } });
  const extraRow = subject
    ? [subject.code, "TRUE_FALSE", "EASY", "", "Replace this with your own question", "1", "True", "true", "False", "false", "", "", "", "", ""]
    : undefined;
  return templateCsv(CBT_IMPORT_TEMPLATE_HEADER, [CBT_IMPORT_TEMPLATE_EXAMPLE], extraRow);
}

/// role must match one of the school's own assignable role names exactly
/// (e.g. "Teacher", "Accountant / Bursar") — the second example row uses
/// a real one when the school has any, the same "illustrate with this
/// school's own real setup" approach as the other templates.
export async function buildStaffTemplateCsv(schoolId: string): Promise<string> {
  const role = await prisma.role.findFirst({
    where: { schoolId, key: { notIn: ["SCHOOL_OWNER", "PARENT", "STUDENT"] } },
    orderBy: { name: "asc" },
  });
  const extraRow = role ? ["Mary Okafor", "mary.okafor@example.com", role.name, "", "", "", ""] : undefined;
  return templateCsv(STAFF_IMPORT_TEMPLATE_HEADER, [STAFF_IMPORT_TEMPLATE_EXAMPLE], extraRow);
}
