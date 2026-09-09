import { NextRequest, NextResponse } from "next/server";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { getStudentForUser } from "@/lib/services/portal";
import { prisma } from "@/lib/db";
import { streamOnlineLearningFile } from "@/lib/storage/blob";
import { PERMISSIONS } from "@/lib/permissions";

/// The only path a lecture file's bytes are ever reachable through — the
/// stored Vercel Blob url (private access, see src/lib/storage/blob.ts) is
/// never sent to a browser directly. Re-runs the exact same visibility rule
/// as the lecture itself: the requesting user must be the owning teacher,
/// an enrolled student of the lecture's own classArm with the lecture
/// PUBLISHED, or a school admin with online_learning.view_all — never a
/// bare "is this school's row" check alone.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params;
  const user = await requireSchoolUser();

  const resource = await prisma.lectureResource.findFirst({
    where: { id: resourceId, lecture: { schoolId: user.schoolId } },
    include: { lecture: true },
  });
  if (!resource || !resource.fileUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = false;
  if (resource.lecture.teacherId === user.id) {
    allowed = true;
  } else if (user.role === "STUDENT") {
    const student = await getStudentForUser(user.schoolId, user.id);
    allowed = Boolean(student && student.classArmId === resource.lecture.classArmId && resource.lecture.status === "PUBLISHED");
  }
  if (!allowed) {
    const perms = await getUserPermissions(user.id);
    allowed = perms.has(PERMISSIONS.ONLINE_LEARNING_VIEW_ALL);
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const file = await streamOnlineLearningFile(resource.fileUrl);
  if (!file) return NextResponse.json({ error: "File not available" }, { status: 404 });

  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
