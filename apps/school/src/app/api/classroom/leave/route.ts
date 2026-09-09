import { NextRequest, NextResponse } from "next/server";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { recordStudentLeave } from "@/lib/services/live-classes";

/// Best-effort endpoint for `navigator.sendBeacon` on tab close/refresh —
/// a normal "Leave" click uses leaveClassroomAction (src/app/classroom/actions.ts)
/// directly instead. sendBeacon can't invoke a Server Action, only a plain
/// URL, hence this thin duplicate. Never trusts the posted body for
/// identity — the student is always re-derived from the session cookie
/// sendBeacon carries along automatically for a same-origin request.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { liveClassId?: string } | null;
    if (!body?.liveClassId) return NextResponse.json({ ok: false }, { status: 400 });

    const user = await requireSchoolUser();
    if (user.role === "STUDENT") {
      const student = await getStudentForUser(user.schoolId, user.id);
      if (student) await recordStudentLeave(user.schoolId, student.id, body.liveClassId);
    }
  } catch {
    // Best-effort — a failed beacon must never surface an error to the
    // (already-navigating-away) browser.
  }
  return NextResponse.json({ ok: true });
}
