"use server";

import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import {
  mintTeacherClassroomToken,
  mintStudentClassroomToken,
  recordStudentLeave,
  setHandRaised,
  lowerStudentHand,
  muteStudentInClassroom,
  removeStudentFromClassroom,
  setClassroomChatEnabled,
  sendClassroomMessage,
  listClassroomMessages,
  deleteClassroomMessage,
  startLiveClass,
  endLiveClass,
} from "@/lib/services/live-classes";
import { getLiveKitWsUrl } from "@/lib/live-classroom/livekit";

/// Resolves the calling session to the identity every live-classes.ts
/// function expects: a Student.id for a student (matching
/// LiveClassAttendance.studentId), or the User.id for a teacher (matching
/// LiveClass.teacherId) — never trusted from the client, always re-derived
/// from the authenticated session on every call.
async function identify() {
  const user = await requireSchoolUser();
  const name = user.name ?? "Winfield user";
  if (user.role === "STUDENT") {
    const student = await getStudentForUser(user.schoolId, user.id);
    if (!student) throw new Error("Student profile not found.");
    return { schoolId: user.schoolId, id: student.id, name, role: "student" as const };
  }
  return { schoolId: user.schoolId, id: user.id, name, role: "teacher" as const };
}

export async function joinClassroomAction(liveClassId: string) {
  const me = await identify();
  const wsUrl = getLiveKitWsUrl();
  if (!wsUrl) throw new Error("The live classroom is not configured for this deployment yet.");

  if (me.role === "teacher") {
    const { token, roomName } = await mintTeacherClassroomToken(me.schoolId, me.id, me.name, liveClassId);
    return { token, wsUrl, roomName, role: "teacher" as const, identity: me.id, name: me.name };
  }
  const { token, roomName } = await mintStudentClassroomToken(me.schoolId, me.id, me.name, liveClassId);
  return { token, wsUrl, roomName, role: "student" as const, identity: me.id, name: me.name };
}

export async function leaveClassroomAction(liveClassId: string) {
  const me = await identify();
  if (me.role === "student") await recordStudentLeave(me.schoolId, me.id, liveClassId);
}

export async function toggleHandRaiseAction(liveClassId: string, raised: boolean) {
  const me = await identify();
  if (me.role !== "student") return;
  await setHandRaised(me.schoolId, me.id, liveClassId, raised);
}

export async function sendChatMessageAction(liveClassId: string, body: string) {
  const me = await identify();
  const message = await sendClassroomMessage(me.schoolId, me.id, me.role, liveClassId, body);
  return { id: message.id, body: message.body, senderName: message.sender.name, createdAt: message.createdAt.toISOString() };
}

export async function fetchChatHistoryAction(liveClassId: string) {
  const me = await identify();
  const messages = await listClassroomMessages(me.schoolId, me.id, me.role, liveClassId);
  return messages.map((m) => ({ id: m.id, body: m.body, senderName: m.sender.name, createdAt: m.createdAt.toISOString() }));
}

async function requireTeacherIdentity() {
  const me = await identify();
  if (me.role !== "teacher") throw new Error("Only the teacher can do this.");
  return me;
}

export async function muteStudentAction(liveClassId: string, studentId: string) {
  const me = await requireTeacherIdentity();
  await muteStudentInClassroom(me.schoolId, me.id, liveClassId, studentId);
}

export async function removeStudentAction(liveClassId: string, studentId: string) {
  const me = await requireTeacherIdentity();
  await removeStudentFromClassroom(me.schoolId, me.id, liveClassId, studentId);
}

export async function lowerHandAction(liveClassId: string, studentId: string) {
  const me = await requireTeacherIdentity();
  await lowerStudentHand(me.schoolId, me.id, liveClassId, studentId);
}

export async function toggleChatEnabledAction(liveClassId: string, enabled: boolean) {
  const me = await requireTeacherIdentity();
  await setClassroomChatEnabled(me.schoolId, me.id, liveClassId, enabled);
}

export async function deleteChatMessageAction(liveClassId: string, messageId: string) {
  const me = await requireTeacherIdentity();
  await deleteClassroomMessage(me.schoolId, me.id, liveClassId, messageId);
}

export async function startClassFromRoomAction(liveClassId: string) {
  const me = await requireTeacherIdentity();
  await startLiveClass(me.schoolId, me.id, liveClassId);
  revalidatePath("/dashboard/online-learning/live-classes");
  revalidatePath(`/classroom/${liveClassId}`);
}

export async function endClassFromRoomAction(liveClassId: string) {
  const me = await requireTeacherIdentity();
  await endLiveClass(me.schoolId, me.id, liveClassId);
  revalidatePath("/dashboard/online-learning/live-classes");
}
