import "server-only";
import { prisma } from "@/lib/db";
import { assertTeacherAssignment } from "@/lib/services/lectures";
import { notifyLiveClassScheduled, notifyLiveClassStarted, notifyLiveClassCancelled } from "@/lib/services/notifications";
import {
  ensureClassroomRoom,
  endClassroomRoom,
  mintClassroomToken,
  removeParticipantFromRoom,
  forceMuteParticipantMicrophone,
  isLiveClassroomConfigured,
} from "@/lib/live-classroom/livekit";

/// A student is only ever allowed into a LiveClass room after passing every
/// check the brief's "Live Class Access Control" section lists — this
/// function is the single place that happens, called from both the "can I
/// see the join button" read path and the token-mint route immediately
/// before issuing real access. Never short-circuit or duplicate this logic
/// elsewhere.
export type LiveClassAccessState =
  | { ok: true; liveClass: NonNullable<Awaited<ReturnType<typeof findLiveClassForSchool>>> }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "waiting_for_teacher"; liveClass: NonNullable<Awaited<ReturnType<typeof findLiveClassForSchool>>> }
  | { ok: false; reason: "not_open_yet"; liveClass: NonNullable<Awaited<ReturnType<typeof findLiveClassForSchool>>>; opensAt: Date }
  | { ok: false; reason: "ended"; liveClass: NonNullable<Awaited<ReturnType<typeof findLiveClassForSchool>>> }
  | { ok: false; reason: "cancelled"; liveClass: NonNullable<Awaited<ReturnType<typeof findLiveClassForSchool>>> };

async function findLiveClassForSchool(schoolId: string, liveClassId: string) {
  return prisma.liveClass.findFirst({
    where: { schoolId, id: liveClassId },
    include: { subject: true, classArm: { include: { classGroup: true } }, teacher: { select: { id: true, name: true } } },
  });
}

/// Checks 1-6 of the brief's student access-control list: authenticated +
/// correct school are already guaranteed by the caller (requireSchoolUser),
/// "is a student" is checked by the caller reading the session role, and
/// this covers the rest — enrolled in the assigned class, class belongs to
/// this school (implicit in the query), and status actually allows joining.
export async function getStudentLiveClassAccess(schoolId: string, studentId: string, liveClassId: string): Promise<LiveClassAccessState> {
  const liveClass = await findLiveClassForSchool(schoolId, liveClassId);
  if (!liveClass) return { ok: false, reason: "not_found" };

  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId, status: "ACTIVE" }, select: { classArmId: true } });
  if (!student || student.classArmId !== liveClass.classArmId) {
    // Deliberately the SAME "not_found" a nonexistent id would get for a
    // genuinely cross-class/cross-school id — see waiting_for_teacher below
    // for the one case (same class, wrong lifecycle state) where naming the
    // real reason doesn't leak anything a legitimate classmate couldn't
    // already see themselves.
    return { ok: false, reason: "not_found" };
  }

  if (liveClass.status === "CANCELLED") return { ok: false, reason: "cancelled", liveClass };
  if (liveClass.status === "COMPLETED") return { ok: false, reason: "ended", liveClass };
  if (liveClass.status === "LIVE") return { ok: true, liveClass };

  // SCHEDULED: open the waiting room joinWindowMinutesBefore the start time,
  // but real room entry still waits for the teacher's explicit Start.
  const opensAt = new Date(liveClass.scheduledStart.getTime() - liveClass.joinWindowMinutesBefore * 60_000);
  if (new Date() < opensAt) return { ok: false, reason: "not_open_yet", liveClass, opensAt };
  return { ok: false, reason: "waiting_for_teacher", liveClass }; // waiting room: eligible, but teacher hasn't started yet
}

async function assertTeacherOwnsLiveClass(schoolId: string, teacherId: string, liveClassId: string) {
  const liveClass = await prisma.liveClass.findFirst({ where: { schoolId, teacherId, id: liveClassId } });
  if (!liveClass) throw new Error("Live class not found.");
  return liveClass;
}

export interface LiveClassInput {
  subjectId: string;
  classArmId: string;
  academicSessionId: string;
  termId: string;
  title: string;
  topic?: string | null;
  description?: string | null;
  scheduledStart: Date;
  durationMinutes: number;
  maxParticipants?: number | null;
  joinWindowMinutesBefore?: number;
}

async function syncAttendanceRoster(schoolId: string, liveClassId: string, classArmId: string) {
  const students = await prisma.student.findMany({ where: { schoolId, classArmId, status: "ACTIVE" }, select: { id: true } });
  await prisma.liveClassAttendance.createMany({
    data: students.map((s) => ({ schoolId, liveClassId, studentId: s.id })),
    skipDuplicates: true,
  });
}

export async function scheduleLiveClass(schoolId: string, teacherId: string, input: LiveClassInput) {
  await assertTeacherAssignment(schoolId, teacherId, input.subjectId, input.classArmId);

  const liveClass = await prisma.liveClass.create({
    data: {
      schoolId,
      teacherId,
      subjectId: input.subjectId,
      classArmId: input.classArmId,
      academicSessionId: input.academicSessionId,
      termId: input.termId,
      title: input.title,
      topic: input.topic || null,
      description: input.description || null,
      scheduledStart: input.scheduledStart,
      durationMinutes: input.durationMinutes,
      maxParticipants: input.maxParticipants ?? null,
      joinWindowMinutesBefore: input.joinWindowMinutesBefore ?? 15,
      roomName: `live-${crypto.randomUUID()}`,
    },
  });
  await syncAttendanceRoster(schoolId, liveClass.id, input.classArmId);
  await notifyLiveClassScheduled(schoolId, liveClass.id);
  return liveClass;
}

export async function updateLiveClass(schoolId: string, teacherId: string, liveClassId: string, input: LiveClassInput) {
  const existing = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  if (existing.status !== "SCHEDULED") throw new Error("Only a scheduled class can be edited.");
  await assertTeacherAssignment(schoolId, teacherId, input.subjectId, input.classArmId);

  const liveClass = await prisma.liveClass.update({
    where: { id: liveClassId },
    data: {
      subjectId: input.subjectId,
      classArmId: input.classArmId,
      academicSessionId: input.academicSessionId,
      termId: input.termId,
      title: input.title,
      topic: input.topic || null,
      description: input.description || null,
      scheduledStart: input.scheduledStart,
      durationMinutes: input.durationMinutes,
      maxParticipants: input.maxParticipants ?? null,
      joinWindowMinutesBefore: input.joinWindowMinutesBefore ?? existing.joinWindowMinutesBefore,
    },
  });

  if (existing.classArmId !== input.classArmId) {
    await prisma.liveClassAttendance.deleteMany({ where: { liveClassId, firstJoinedAt: null } });
    await syncAttendanceRoster(schoolId, liveClassId, input.classArmId);
  }
  return liveClass;
}

export async function cancelLiveClass(schoolId: string, teacherId: string, liveClassId: string, reason?: string) {
  const existing = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  if (existing.status !== "SCHEDULED" && existing.status !== "LIVE") throw new Error("This class can no longer be cancelled.");
  if (existing.status === "LIVE") await endClassroomRoom(existing.roomName);
  const liveClass = await prisma.liveClass.update({
    where: { id: liveClassId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason || null },
  });
  await notifyLiveClassCancelled(schoolId, liveClassId);
  return liveClass;
}

export async function startLiveClass(schoolId: string, teacherId: string, liveClassId: string) {
  const existing = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  if (existing.status !== "SCHEDULED") throw new Error("This class cannot be started.");
  if (!isLiveClassroomConfigured()) throw new Error("The live classroom is not configured for this deployment yet.");

  await ensureClassroomRoom(existing.roomName, existing.maxParticipants ?? undefined);
  const liveClass = await prisma.liveClass.update({ where: { id: liveClassId }, data: { status: "LIVE", startedAt: new Date() } });
  await notifyLiveClassStarted(schoolId, liveClassId);
  return liveClass;
}

const MIN_ATTENDANCE_PERCENT = 70;

export async function endLiveClass(schoolId: string, teacherId: string, liveClassId: string) {
  const existing = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  if (existing.status !== "LIVE") throw new Error("This class is not live.");

  await endClassroomRoom(existing.roomName);
  const now = new Date();

  // Close every still-open attendance segment (a student who never
  // explicitly left, e.g. their tab just closed) at class-end time.
  const openSegments = await prisma.liveClassAttendanceSegment.findMany({
    where: { leftAt: null, attendance: { liveClassId } },
    include: { attendance: true },
  });
  await Promise.all(
    openSegments.map((segment) =>
      prisma.liveClassAttendanceSegment.update({ where: { id: segment.id }, data: { leftAt: now } })
    )
  );

  const attendanceRows = await prisma.liveClassAttendance.findMany({ where: { schoolId, liveClassId }, include: { segments: true } });
  const requiredSeconds = (existing.durationMinutes * 60 * MIN_ATTENDANCE_PERCENT) / 100;

  await Promise.all(
    attendanceRows.map((row) => {
      const totalConnectedSeconds = row.segments.reduce((sum, seg) => {
        const end = seg.leftAt ?? now;
        return sum + Math.max(0, Math.round((end.getTime() - seg.joinedAt.getTime()) / 1000));
      }, 0);
      const status = !row.firstJoinedAt ? "ABSENT" : totalConnectedSeconds >= requiredSeconds ? "ATTENDED" : "LEFT_EARLY";
      return prisma.liveClassAttendance.update({
        where: { id: row.id },
        data: { totalConnectedSeconds, status, lastLeftAt: row.lastLeftAt ?? now },
      });
    })
  );

  return prisma.liveClass.update({ where: { id: liveClassId }, data: { status: "COMPLETED", endedAt: now } });
}

export interface LiveClassListFilters {
  status?: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
}

export async function listLiveClassesForTeacher(schoolId: string, teacherId: string, filters: LiveClassListFilters = {}) {
  return prisma.liveClass.findMany({
    where: { schoolId, teacherId, ...(filters.status ? { status: filters.status } : {}) },
    include: { subject: true, classArm: { include: { classGroup: true } }, _count: { select: { attendance: true } } },
    orderBy: { scheduledStart: "desc" },
  });
}

/// Admin monitoring (permissions.ONLINE_LEARNING_VIEW_ALL) — every live
/// class in the school regardless of teacher, deliberately a separate
/// function rather than an optional bypass on listLiveClassesForTeacher so
/// a missing permission check can never accidentally widen a teacher-scoped
/// query to the whole school.
export async function listAllLiveClassesForSchool(schoolId: string, filters: LiveClassListFilters = {}) {
  return prisma.liveClass.findMany({
    where: { schoolId, ...(filters.status ? { status: filters.status } : {}) },
    include: { subject: true, classArm: { include: { classGroup: true } }, teacher: { select: { id: true, name: true } }, _count: { select: { attendance: true } } },
    orderBy: { scheduledStart: "desc" },
  });
}

export async function getLiveClassForTeacher(schoolId: string, teacherId: string, liveClassId: string) {
  return prisma.liveClass.findFirst({
    where: { schoolId, teacherId, id: liveClassId },
    include: { subject: true, classArm: { include: { classGroup: true } }, academicSession: true, term: true },
  });
}

export async function listLiveClassesForStudent(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId }, select: { classArmId: true } });
  if (!student?.classArmId) return [];
  return prisma.liveClass.findMany({
    where: { schoolId, classArmId: student.classArmId, status: { not: "CANCELLED" } },
    include: { subject: true, teacher: { select: { id: true, name: true } } },
    orderBy: { scheduledStart: "desc" },
  });
}

export async function getLiveClassAttendanceForTeacher(schoolId: string, teacherId: string, liveClassId: string) {
  await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  return prisma.liveClassAttendance.findMany({
    where: { schoolId, liveClassId },
    include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
}

// ---------------------------------------------------------------------------
// Room entry (token minting) — the ONLY path a browser gets a LiveKit token
// through. Both roles funnel through getStudentLiveClassAccess /
// assertTeacherOwnsLiveClass first; neither ever mints a token off a bare
// liveClassId without that check running fresh on every request (the token
// route never caches "was allowed once").
// ---------------------------------------------------------------------------

export async function mintTeacherClassroomToken(schoolId: string, teacherId: string, teacherName: string, liveClassId: string) {
  const liveClass = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  if (liveClass.status !== "LIVE") throw new Error("Start the class before entering the classroom.");
  const token = await mintClassroomToken(liveClass.roomName, { userId: teacherId, name: teacherName, role: "teacher" });
  if (!token) throw new Error("The live classroom is not configured for this deployment yet.");
  return { token, roomName: liveClass.roomName };
}

export async function mintStudentClassroomToken(schoolId: string, studentId: string, studentName: string, liveClassId: string) {
  const access = await getStudentLiveClassAccess(schoolId, studentId, liveClassId);
  if (!access.ok) throw new Error("You are not able to join this class right now.");
  const token = await mintClassroomToken(access.liveClass.roomName, { userId: studentId, name: studentName, role: "student" });
  if (!token) throw new Error("The live classroom is not configured for this deployment yet.");

  const now = new Date();
  const existing = await prisma.liveClassAttendance.findFirst({ where: { schoolId, liveClassId, studentId } });
  const attendance = existing
    ? await prisma.liveClassAttendance.update({
        where: { id: existing.id },
        data: { status: "JOINED", firstJoinedAt: existing.firstJoinedAt ?? now },
      })
    : await prisma.liveClassAttendance.create({
        data: { schoolId, liveClassId, studentId, firstJoinedAt: now, status: "JOINED" },
      });

  // Only open a new connection segment if the previous one was already
  // closed — a repeated token mint from the same still-open tab (e.g. a
  // React effect re-run) must never fabricate a second concurrent segment.
  const openSegment = await prisma.liveClassAttendanceSegment.findFirst({ where: { attendanceId: attendance.id, leftAt: null } });
  if (!openSegment) {
    await prisma.liveClassAttendanceSegment.create({ data: { attendanceId: attendance.id, joinedAt: now } });
  }

  return { token, roomName: access.liveClass.roomName };
}

/// Called on an explicit "Leave class" click, and best-effort from a
/// `navigator.sendBeacon`/`visibilitychange` handler on tab close —
/// whichever fires first closes the open segment; a beacon that never
/// arrives (browser killed, connection lost) simply leaves the segment open
/// until endLiveClass finalizes it at class-end, which is exactly the
/// "don't immediately mark absent on a drop" behavior the brief asks for.
export async function recordStudentLeave(schoolId: string, studentId: string, liveClassId: string) {
  const attendance = await prisma.liveClassAttendance.findFirst({ where: { schoolId, liveClassId, studentId } });
  if (!attendance) return;
  const now = new Date();
  const openSegment = await prisma.liveClassAttendanceSegment.findFirst({ where: { attendanceId: attendance.id, leftAt: null } });
  if (openSegment) {
    await prisma.liveClassAttendanceSegment.update({ where: { id: openSegment.id }, data: { leftAt: now } });
  }
  await prisma.liveClassAttendance.update({ where: { id: attendance.id }, data: { lastLeftAt: now } });
}

// ---------------------------------------------------------------------------
// In-room state: raised hands, chat, teacher moderation.
// ---------------------------------------------------------------------------

export async function setHandRaised(schoolId: string, studentId: string, liveClassId: string, raised: boolean) {
  await prisma.liveClassAttendance.updateMany({ where: { schoolId, liveClassId, studentId }, data: { handRaised: raised } });
}

export async function lowerStudentHand(schoolId: string, teacherId: string, liveClassId: string, studentId: string) {
  await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  await prisma.liveClassAttendance.updateMany({ where: { schoolId, liveClassId, studentId }, data: { handRaised: false } });
}

export async function setParticipantMediaState(
  schoolId: string,
  studentId: string,
  liveClassId: string,
  state: { micMuted?: boolean; cameraOn?: boolean }
) {
  await prisma.liveClassAttendance.updateMany({ where: { schoolId, liveClassId, studentId }, data: state });
}

export async function listRaisedHands(schoolId: string, liveClassId: string) {
  return prisma.liveClassAttendance.findMany({
    where: { schoolId, liveClassId, handRaised: true },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
}

export async function muteStudentInClassroom(schoolId: string, teacherId: string, liveClassId: string, studentId: string) {
  const liveClass = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  await forceMuteParticipantMicrophone(liveClass.roomName, studentId);
  await setParticipantMediaState(schoolId, studentId, liveClassId, { micMuted: true });
}

export async function removeStudentFromClassroom(schoolId: string, teacherId: string, liveClassId: string, studentId: string) {
  const liveClass = await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  await removeParticipantFromRoom(liveClass.roomName, studentId);
  await recordStudentLeave(schoolId, studentId, liveClassId);
}

export async function setClassroomChatEnabled(schoolId: string, teacherId: string, liveClassId: string, enabled: boolean) {
  await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  await prisma.liveClass.update({ where: { id: liveClassId }, data: { chatEnabled: enabled } });
}

async function assertCanUseClassroomRoom(schoolId: string, userId: string, role: "teacher" | "student", liveClassId: string) {
  if (role === "teacher") {
    return assertTeacherOwnsLiveClass(schoolId, userId, liveClassId);
  }
  const access = await getStudentLiveClassAccess(schoolId, userId, liveClassId);
  if (!access.ok) throw new Error("You do not have access to this class.");
  return access.liveClass;
}

export async function sendClassroomMessage(
  schoolId: string,
  senderId: string,
  role: "teacher" | "student",
  liveClassId: string,
  body: string
) {
  const liveClass = await assertCanUseClassroomRoom(schoolId, senderId, role, liveClassId);
  if (!liveClass.chatEnabled && role === "student") throw new Error("Chat has been disabled for this class.");
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) throw new Error("Message cannot be empty.");
  return prisma.classroomMessage.create({
    data: { schoolId, liveClassId, senderId, body: trimmed },
    include: { sender: { select: { name: true } } },
  });
}

export async function listClassroomMessages(schoolId: string, viewerId: string, role: "teacher" | "student", liveClassId: string) {
  await assertCanUseClassroomRoom(schoolId, viewerId, role, liveClassId);
  return prisma.classroomMessage.findMany({
    where: { schoolId, liveClassId, deletedAt: null },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

export async function deleteClassroomMessage(schoolId: string, teacherId: string, liveClassId: string, messageId: string) {
  await assertTeacherOwnsLiveClass(schoolId, teacherId, liveClassId);
  await prisma.classroomMessage.updateMany({
    where: { schoolId, liveClassId, id: messageId },
    data: { deletedAt: new Date(), deletedById: teacherId },
  });
}
