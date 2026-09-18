import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireSchoolUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { generatePreschoolReportPdfBuffer } from "@/lib/services/preschool-report-pdf";
import { getChildForGuardian } from "@/lib/services/portal";

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  // Same dual-access pattern as /api/report-cards/[studentId]/pdf. A portal
  // user additionally needs the report to actually be PUBLISHED, and the
  // school's own preschoolParentsCanView/preschoolStudentsCanView setting
  // to allow it — a staff RESULTS_VIEW holder can pull any status.
  const staffUser = await requirePermission(PERMISSIONS.RESULTS_VIEW).catch(() => null);
  let schoolId: string;
  let isPortalUser = false;
  let isStudentSelf = false;
  if (staffUser) {
    schoolId = staffUser.schoolId;
  } else {
    const portalUser = await requireSchoolUser().catch(() => null);
    if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isOwnRecord = await prisma.student.findFirst({ where: { schoolId: portalUser.schoolId, id: studentId, userId: portalUser.id } });
    const isMyChild = isOwnRecord ? null : await getChildForGuardian(portalUser.schoolId, portalUser.id, studentId);
    if (!isOwnRecord && !isMyChild) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    schoolId = portalUser.schoolId;
    isPortalUser = true;
    isStudentSelf = Boolean(isOwnRecord);
  }

  const termId = req.nextUrl.searchParams.get("termId");
  if (!termId) return NextResponse.json({ error: "Missing termId" }, { status: 400 });

  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isPortalUser) {
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const allowed = isStudentSelf ? school.preschoolStudentsCanView : school.preschoolParentsCanView;
    if (!allowed) return NextResponse.json({ error: "Not available" }, { status: 403 });

    const report = await prisma.preschoolReport.findFirst({ where: { schoolId, studentId, termId } });
    if (!report || report.status !== "PUBLISHED") return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const pdf = await generatePreschoolReportPdfBuffer(schoolId, studentId, termId);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.admissionNumber}-milestone-report.pdf"`,
    },
  });
}
