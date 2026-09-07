import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { generateReportCardPdfBuffer } from "@/lib/services/report-card-pdf";

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;
  const termId = req.nextUrl.searchParams.get("termId");
  if (!termId) return NextResponse.json({ error: "Missing termId" }, { status: 400 });

  const student = await prisma.student.findFirst({ where: { schoolId: user.schoolId, id: studentId } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await generateReportCardPdfBuffer(user.schoolId, studentId, termId);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.admissionNumber}-report-card.pdf"`,
    },
  });
}
