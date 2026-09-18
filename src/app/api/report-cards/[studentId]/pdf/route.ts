import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireSchoolUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { generateReportCardPdfBuffer } from "@/lib/services/report-card-pdf";
import { getChildForGuardian } from "@/lib/services/portal";

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  // Staff with RESULTS_VIEW can pull up any student's report card; a
  // parent/student portal account can only reach their own child/self —
  // checked explicitly rather than via the module.action permission system,
  // since PARENT/STUDENT roles intentionally carry no staff permissions.
  const staffUser = await requirePermission(PERMISSIONS.RESULTS_VIEW).catch(() => null);
  let schoolId: string;
  if (staffUser) {
    schoolId = staffUser.schoolId;
  } else {
    const portalUser = await requireSchoolUser().catch(() => null);
    if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isOwnRecord = await prisma.student.findFirst({ where: { schoolId: portalUser.schoolId, id: studentId, userId: portalUser.id } });
    const isMyChild = isOwnRecord ? null : await getChildForGuardian(portalUser.schoolId, portalUser.id, studentId);
    if (!isOwnRecord && !isMyChild) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    schoolId = portalUser.schoolId;
  }

  const termId = req.nextUrl.searchParams.get("termId");
  if (!termId) return NextResponse.json({ error: "Missing termId" }, { status: 400 });

  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await generateReportCardPdfBuffer(schoolId, studentId, termId);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.admissionNumber}-report-card.pdf"`,
    },
  });
}
