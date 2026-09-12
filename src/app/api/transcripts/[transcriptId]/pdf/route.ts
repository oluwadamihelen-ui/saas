import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireSchoolUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getTranscript, recordTranscriptEvent } from "@/lib/services/transcripts";
import { generateTranscriptPdfBuffer } from "@/lib/services/transcript-pdf";
import { getChildForGuardian } from "@/lib/services/portal";

export async function GET(req: NextRequest, { params }: { params: Promise<{ transcriptId: string }> }) {
  const { transcriptId } = await params;

  // Staff with TRANSCRIPTS_VIEW can pull up any student's transcript; a
  // parent/student portal account can only reach their own child/self —
  // checked explicitly rather than via the module.action permission system,
  // same dual-access pattern as the report card PDF route.
  const staffUser = await requirePermission(PERMISSIONS.TRANSCRIPTS_VIEW).catch(() => null);
  let schoolId: string;
  let actingUserId: string;
  if (staffUser) {
    schoolId = staffUser.schoolId;
    actingUserId = staffUser.id;
  } else {
    const portalUser = await requireSchoolUser().catch(() => null);
    if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    schoolId = portalUser.schoolId;
    actingUserId = portalUser.id;
  }

  const transcript = await getTranscript(schoolId, transcriptId);
  if (!transcript) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!staffUser) {
    const isOwnRecord = await prisma.student.findFirst({ where: { schoolId, id: transcript.studentId, userId: actingUserId } });
    const isMyChild = isOwnRecord ? null : await getChildForGuardian(schoolId, actingUserId, transcript.studentId);
    if (!isOwnRecord && !isMyChild) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let pdf: Buffer;
  try {
    pdf = await generateTranscriptPdfBuffer(schoolId, transcriptId);
  } catch {
    return NextResponse.json({ error: "Transcript generation failed." }, { status: 500 });
  }

  const event = req.nextUrl.searchParams.get("event") === "print" ? "printed" : "downloaded";
  await recordTranscriptEvent(schoolId, actingUserId, transcriptId, event);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${transcript.student.admissionNumber}-transcript.pdf"`,
    },
  });
}
