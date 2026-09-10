import { NextResponse } from "next/server";
import { requirePermission, requireSchoolUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getChildForGuardian } from "@/lib/services/portal";

/// A single student's full record as one JSON file — everything the
/// school holds about them, not just their profile fields: guardians,
/// scores and report card sign-off, attendance, assignment submissions,
/// CBT exam attempts, invoices and payments, library loans, transport and
/// hostel assignments, and online learning activity. For a school (or a
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
      reportCards: { include: { term: { include: { academicSession: true } }, approvedBy: { select: { name: true } } } },
      attendanceRecords: { include: { term: true } },
      submissions: { include: { assignment: { include: { subject: true, term: true } }, gradedBy: { select: { name: true } } } },
      cbtAttempts: {
        include: { exam: { include: { subject: true, term: true } } },
        orderBy: { startedAt: "asc" },
      },
      invoices: { include: { items: true, term: true, payments: true } },
      bookLoans: { include: { book: true } },
      transportAssignments: { include: { route: { include: { vehicle: true } }, stop: true } },
      hostelAssignments: { include: { room: { include: { hostel: true } } } },
      lectureProgress: { include: { lecture: { include: { subject: true, term: true } } } },
      liveClassAttendance: { include: { liveClass: { include: { subject: true, term: true } } } },
    },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
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
    academics: {
      scores: student.scores.map((s) => ({
        session: s.term.academicSession.name,
        term: s.term.name,
        subject: s.subject.name,
        component: s.component.name,
        score: s.value,
        maxScore: s.component.maxScore,
      })),
      reportCards: student.reportCards.map((rc) => ({
        session: rc.term.academicSession.name,
        term: rc.term.name,
        status: rc.status,
        teacherComment: rc.teacherComment,
        principalComment: rc.principalComment,
        approvedBy: rc.approvedBy?.name ?? null,
        approvedAt: rc.approvedAt,
        publishedAt: rc.publishedAt,
      })),
      assignments: student.submissions.map((s) => ({
        term: s.assignment.term.name,
        subject: s.assignment.subject.name,
        title: s.assignment.title,
        dueDate: s.assignment.dueDate,
        status: s.status,
        score: s.score,
        feedback: s.feedback,
        gradedBy: s.gradedBy?.name ?? null,
        gradedAt: s.gradedAt,
      })),
    },
    cbtExams: student.cbtAttempts.map((a) => ({
      term: a.exam.term.name,
      subject: a.exam.subject.name,
      exam: a.exam.title,
      attemptNumber: a.attemptNumber,
      status: a.status,
      isOfficialResult: a.isOfficialResult,
      score: a.score,
      percentage: a.percentage,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
    })),
    attendance: student.attendanceRecords.map((a) => ({ term: a.term.name, date: a.date, status: a.status })),
    finance: {
      invoices: student.invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        term: inv.term.name,
        status: inv.status,
        totalMinor: inv.totalMinor,
        dueDate: inv.dueDate,
        items: inv.items.map((item) => ({ description: item.description, amountMinor: item.amountMinor })),
        payments: inv.payments.map((p) => ({
          amountMinor: p.amountMinor,
          method: p.method,
          status: p.status,
          reference: p.reference,
          paidAt: p.paidAt,
        })),
      })),
    },
    library: student.bookLoans.map((l) => ({
      book: l.book.title,
      author: l.book.author,
      issuedAt: l.issuedAt,
      dueAt: l.dueAt,
      returnedAt: l.returnedAt,
      status: l.status,
    })),
    transport: student.transportAssignments.map((a) => ({
      route: a.route.name,
      vehicle: a.route.vehicle?.name ?? null,
      stop: a.stop?.name ?? null,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
    })),
    hostel: student.hostelAssignments.map((a) => ({
      hostel: a.room.hostel.name,
      room: a.room.roomNumber,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
    })),
    onlineLearning: {
      lectures: student.lectureProgress.map((p) => ({
        term: p.lecture.term.name,
        subject: p.lecture.subject.name,
        lecture: p.lecture.title,
        status: p.status,
        progressPercent: p.progressPercent,
        completedAt: p.completedAt,
      })),
      liveClasses: student.liveClassAttendance.map((a) => ({
        term: a.liveClass.term.name,
        subject: a.liveClass.subject.name,
        liveClass: a.liveClass.title,
        status: a.status,
        totalConnectedSeconds: a.totalConnectedSeconds,
      })),
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${student.admissionNumber}-export.json"`,
    },
  });
}
