import { NextResponse } from "next/server";
import { requirePermission, requireSchoolUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getChildForGuardian } from "@/lib/services/portal";

/// A single student's full record as one JSON file — for a school (or a
/// parent/student backing up their own data) to keep offline, independent
/// of Winfield. Same dual-access pattern as the transcript PDF route:
/// staff with STUDENTS_VIEW can pull any student in their school, while a
/// parent/student portal account can only reach their own child/self.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const staffUser = await requirePermission(PERMISSIONS.STUDENTS_VIEW).catch(() => null);
  let schoolId: string;
  if (staffUser) {
    schoolId = staffUser.schoolId;
  } else {
    const portalUser = await requireSchoolUser().catch(() => null);
    if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    schoolId = portalUser.schoolId;

    const isOwnRecord = await prisma.student.findFirst({ where: { schoolId, id, userId: portalUser.id } });
    const isMyChild = isOwnRecord ? null : await getChildForGuardian(schoolId, portalUser.id, id);
    if (!isOwnRecord && !isMyChild) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findFirst({
    where: { schoolId, id },
    include: {
      classArm: { include: { classGroup: true } },
      campus: true,
      guardians: { include: { guardian: true } },
      scores: { include: { subject: true, component: true, term: { include: { academicSession: true } } } },
      attendanceRecords: { include: { term: true } },
      invoices: { include: { items: true, term: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = {
    exportedAt: new Date().toISOString(),
    student: {
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      otherNames: student.otherNames,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      bloodGroup: student.bloodGroup,
      nationality: student.nationality,
      address: [student.addressLine, student.city, student.state].filter(Boolean).join(", ") || null,
      medicalNotes: student.medicalNotes,
      allergies: student.allergies,
      emergencyContact: student.emergencyContact,
      status: student.status,
      admissionDate: student.admissionDate,
      class: student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : null,
      campus: student.campus?.name ?? null,
    },
    guardians: student.guardians.map((sg) => ({
      firstName: sg.guardian.firstName,
      lastName: sg.guardian.lastName,
      phone: sg.guardian.phone,
      email: sg.guardian.email,
      relationship: sg.relationship,
      isPrimary: sg.isPrimary,
    })),
    scores: student.scores.map((s) => ({
      session: s.term.academicSession.name,
      term: s.term.name,
      subject: s.subject.name,
      component: s.component.name,
      score: s.value,
      maxScore: s.component.maxScore,
    })),
    attendance: student.attendanceRecords.map((a) => ({ term: a.term.name, date: a.date, status: a.status })),
    invoices: student.invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      term: inv.term.name,
      status: inv.status,
      totalMinor: inv.totalMinor,
      dueDate: inv.dueDate,
      items: inv.items.map((item) => ({ description: item.description, amountMinor: item.amountMinor })),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${student.admissionNumber}-export.json"`,
    },
  });
}
