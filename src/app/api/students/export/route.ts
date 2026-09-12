import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";

const HEADER = [
  "admissionNumber",
  "firstName",
  "lastName",
  "otherNames",
  "gender",
  "dateOfBirth",
  "className",
  "status",
  "address",
  "city",
  "state",
  "bloodGroup",
  "emergencyContact",
  "allergies",
  "medicalNotes",
  "guardianFirstName",
  "guardianLastName",
  "guardianPhone",
  "guardianEmail",
  "guardianRelationship",
];

/// A school-wide backup of its own student roster, in the same column
/// shape the bulk importer accepts (see student-import.ts) so the file
/// round-trips — export from one environment, import into another.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.STUDENTS_VIEW).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await prisma.student.findMany({
    where: { schoolId: user.schoolId },
    include: {
      classArm: { include: { classGroup: true } },
      guardians: { include: { guardian: true }, where: { isPrimary: true }, take: 1 },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = students.map((s) => {
    const guardian = s.guardians[0]?.guardian;
    return [
      s.admissionNumber,
      s.firstName,
      s.lastName,
      s.otherNames ?? "",
      s.gender ?? "",
      s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : "",
      s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "",
      s.status,
      s.addressLine ?? "",
      s.city ?? "",
      s.state ?? "",
      s.bloodGroup ?? "",
      s.emergencyContact ?? "",
      s.allergies ?? "",
      s.medicalNotes ?? "",
      guardian?.firstName ?? "",
      guardian?.lastName ?? "",
      guardian?.phone ?? "",
      guardian?.email ?? "",
      s.guardians[0]?.relationship ?? "",
    ];
  });

  const csv = rowsToCsv(HEADER, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-export.csv"`,
    },
  });
}
