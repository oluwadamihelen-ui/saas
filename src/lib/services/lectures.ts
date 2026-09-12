import "server-only";
import { prisma } from "@/lib/db";
import { deleteOnlineLearningFile } from "@/lib/storage/blob";
import { notifyLecturePublished } from "@/lib/services/notifications";
import type { LectureResourceType, Prisma } from "@/generated/prisma/client";

/// Every write below scopes its WHERE clause to schoolId AND (for a
/// teacher-authored row) teacherId — the same "no path to a bare unscoped
/// query" discipline as students.ts. A teacher can never read or edit
/// another teacher's lecture, and a lecture from School A is structurally
/// unreachable from School B's session no matter what id is guessed,
/// because the id alone never satisfies a WHERE that also requires this
/// session's own schoolId.

export interface LectureResourceInput {
  type: LectureResourceType;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  externalUrl?: string | null;
  writtenContent?: string | null;
  fileSizeBytes?: number | null;
  durationSeconds?: number | null;
}

export interface LectureInput {
  subjectId: string;
  classArmId: string;
  academicSessionId: string;
  termId: string;
  title: string;
  topic?: string | null;
  description?: string | null;
  learningObjectives?: string | null;
  instructions?: string | null;
  dueDate?: Date | null;
  resources: LectureResourceInput[];
}

/// The one gate every lecture/live-class create or edit must pass: a
/// teacher may only act on a subject+classArm pair they are actually
/// assigned to (TeacherAssignment), never merely because they hold
/// lectures.manage generally. Never trust a subjectId/classArmId that
/// arrives from a client without re-checking this server-side.
export async function assertTeacherAssignment(schoolId: string, teacherId: string, subjectId: string, classArmId: string) {
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { schoolId, teacherId, subjectId, classArmId },
  });
  if (!assignment) {
    throw new Error("You are not assigned to teach this subject for this class.");
  }
}

export async function listTeachableAssignments(schoolId: string, teacherId: string) {
  return prisma.teacherAssignment.findMany({
    where: { schoolId, teacherId },
    include: { subject: true, classArm: { include: { classGroup: true } } },
    orderBy: [{ classArm: { classGroup: { order: "asc" } } }, { subject: { name: "asc" } }],
  });
}

async function replaceLectureResources(tx: Prisma.TransactionClient, lectureId: string, resources: LectureResourceInput[]) {
  const existing = await tx.lectureResource.findMany({ where: { lectureId } });
  await tx.lectureResource.deleteMany({ where: { lectureId } });
  // Fire-and-forget cleanup of files that were replaced/removed — never
  // await inside the transaction (blob storage is not transactional with
  // Postgres), and never let a storage hiccup roll back the DB write.
  for (const old of existing) {
    if (old.fileUrl && !resources.some((r) => r.fileUrl === old.fileUrl)) {
      void deleteOnlineLearningFile(old.fileUrl);
    }
  }
  if (resources.length > 0) {
    await tx.lectureResource.createMany({
      data: resources.map((r, order) => ({
        lectureId,
        type: r.type,
        title: r.title,
        description: r.description || null,
        fileUrl: r.fileUrl || null,
        externalUrl: r.externalUrl || null,
        writtenContent: r.writtenContent || null,
        fileSizeBytes: r.fileSizeBytes ?? null,
        durationSeconds: r.durationSeconds ?? null,
        order,
      })),
    });
  }
}

export async function createLecture(schoolId: string, teacherId: string, input: LectureInput) {
  await assertTeacherAssignment(schoolId, teacherId, input.subjectId, input.classArmId);

  return prisma.$transaction(async (tx) => {
    const lecture = await tx.lecture.create({
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
        learningObjectives: input.learningObjectives || null,
        instructions: input.instructions || null,
        dueDate: input.dueDate ?? null,
      },
    });
    await replaceLectureResources(tx, lecture.id, input.resources);
    return lecture;
  });
}

export async function updateLecture(schoolId: string, teacherId: string, lectureId: string, input: LectureInput) {
  const existing = await prisma.lecture.findFirst({ where: { schoolId, teacherId, id: lectureId } });
  if (!existing) throw new Error("Lecture not found.");
  await assertTeacherAssignment(schoolId, teacherId, input.subjectId, input.classArmId);

  return prisma.$transaction(async (tx) => {
    const lecture = await tx.lecture.update({
      where: { id: lectureId },
      data: {
        subjectId: input.subjectId,
        classArmId: input.classArmId,
        academicSessionId: input.academicSessionId,
        termId: input.termId,
        title: input.title,
        topic: input.topic || null,
        description: input.description || null,
        learningObjectives: input.learningObjectives || null,
        instructions: input.instructions || null,
        dueDate: input.dueDate ?? null,
      },
    });
    await replaceLectureResources(tx, lectureId, input.resources);
    return lecture;
  });
}

export async function publishLecture(schoolId: string, teacherId: string, lectureId: string) {
  const existing = await prisma.lecture.findFirst({ where: { schoolId, teacherId, id: lectureId } });
  if (!existing) throw new Error("Lecture not found.");
  const lecture = await prisma.lecture.update({
    where: { id: lectureId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await notifyLecturePublished(schoolId, lectureId);
  return lecture;
}

export async function archiveLecture(schoolId: string, teacherId: string, lectureId: string) {
  const existing = await prisma.lecture.findFirst({ where: { schoolId, teacherId, id: lectureId } });
  if (!existing) throw new Error("Lecture not found.");
  return prisma.lecture.update({ where: { id: lectureId }, data: { status: "ARCHIVED" } });
}

export async function unpublishLectureToDraft(schoolId: string, teacherId: string, lectureId: string) {
  const existing = await prisma.lecture.findFirst({ where: { schoolId, teacherId, id: lectureId } });
  if (!existing) throw new Error("Lecture not found.");
  return prisma.lecture.update({ where: { id: lectureId }, data: { status: "DRAFT", publishedAt: null } });
}

export interface LectureListFilters {
  subjectId?: string;
  classArmId?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export async function listLecturesForTeacher(schoolId: string, teacherId: string, filters: LectureListFilters = {}) {
  return prisma.lecture.findMany({
    where: {
      schoolId,
      teacherId,
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.classArmId ? { classArmId: filters.classArmId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      subject: true,
      classArm: { include: { classGroup: true } },
      term: true,
      _count: { select: { resources: true, progress: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLectureForTeacher(schoolId: string, teacherId: string, lectureId: string) {
  return prisma.lecture.findFirst({
    where: { schoolId, teacherId, id: lectureId },
    include: {
      subject: true,
      classArm: { include: { classGroup: true } },
      academicSession: true,
      term: true,
      resources: { orderBy: { order: "asc" } },
    },
  });
}

export async function deleteDraftLecture(schoolId: string, teacherId: string, lectureId: string) {
  const existing = await prisma.lecture.findFirst({ where: { schoolId, teacherId, id: lectureId }, include: { resources: true } });
  if (!existing) throw new Error("Lecture not found.");
  if (existing.status !== "DRAFT") throw new Error("Only a draft lecture can be deleted — archive a published lecture instead.");
  for (const resource of existing.resources) {
    if (resource.fileUrl) void deleteOnlineLearningFile(resource.fileUrl);
  }
  await prisma.lecture.delete({ where: { id: lectureId } });
}

// ---------------------------------------------------------------------------
// Student-facing reads — the security-critical half of this file. Every
// function below is scoped to the CALLING student's own classArmId, looked
// up fresh from the Student row rather than trusted from a parameter, so a
// student can never widen their own visibility by passing a different
// classArmId.
// ---------------------------------------------------------------------------

export async function listLecturesForStudent(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId }, select: { classArmId: true } });
  if (!student?.classArmId) return [];

  return prisma.lecture.findMany({
    where: { schoolId, classArmId: student.classArmId, status: "PUBLISHED" },
    include: {
      subject: true,
      teacher: { select: { id: true, name: true } },
      resources: { orderBy: { order: "asc" }, take: 1 },
      progress: { where: { studentId } },
    },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getLectureForStudent(schoolId: string, studentId: string, lectureId: string) {
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId }, select: { classArmId: true } });
  if (!student?.classArmId) return null;

  const lecture = await prisma.lecture.findFirst({
    where: { schoolId, id: lectureId, classArmId: student.classArmId, status: "PUBLISHED" },
    include: {
      subject: true,
      teacher: { select: { id: true, name: true } },
      resources: { orderBy: { order: "asc" } },
    },
  });
  if (!lecture) return null;

  const progress = await prisma.studentLectureProgress.findUnique({
    where: { lectureId_studentId: { lectureId, studentId } },
  });

  const [previous, next] = await Promise.all([
    prisma.lecture.findFirst({
      where: { schoolId, classArmId: student.classArmId, status: "PUBLISHED", publishedAt: { lt: lecture.publishedAt ?? new Date() } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.lecture.findFirst({
      where: { schoolId, classArmId: student.classArmId, status: "PUBLISHED", publishedAt: { gt: lecture.publishedAt ?? new Date() } },
      orderBy: { publishedAt: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return { lecture, progress, previous, next };
}

/// Upserted the first time a student opens a lecture — never marks it
/// COMPLETED, only NOT_STARTED -> IN_PROGRESS. See the module doc comment on
/// StudentLectureProgress in schema.prisma for why completion has its own,
/// separate entry points below.
export async function markLectureOpened(schoolId: string, studentId: string, lectureId: string) {
  const lecture = await verifyStudentCanAccessLecture(schoolId, studentId, lectureId);
  if (!lecture) throw new Error("Lecture not found.");

  const now = new Date();
  await prisma.studentLectureProgress.upsert({
    where: { lectureId_studentId: { lectureId, studentId } },
    create: { schoolId, lectureId, studentId, status: "IN_PROGRESS", firstOpenedAt: now, lastAccessedAt: now },
    update: { lastAccessedAt: now, status: "IN_PROGRESS" },
  });
}

async function verifyStudentCanAccessLecture(schoolId: string, studentId: string, lectureId: string) {
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId }, select: { classArmId: true } });
  if (!student?.classArmId) return null;
  return prisma.lecture.findFirst({ where: { schoolId, id: lectureId, classArmId: student.classArmId, status: "PUBLISHED" } });
}

const AUTO_COMPLETE_WATCH_PERCENT = 80;

/// Called from the video player's periodic progress callback. Only a
/// meaningful watch percentage (not merely "the page was open") can trip
/// completion — see AUTO_COMPLETE_WATCH_PERCENT — and even then only once;
/// re-watching after completion still updates the resume position but never
/// un-completes the lecture.
export async function updateVideoProgress(
  schoolId: string,
  studentId: string,
  lectureId: string,
  positionSeconds: number,
  durationSeconds: number
) {
  const lecture = await verifyStudentCanAccessLecture(schoolId, studentId, lectureId);
  if (!lecture) throw new Error("Lecture not found.");
  if (durationSeconds <= 0) return;

  const watchPercent = Math.min(100, Math.round((positionSeconds / durationSeconds) * 100));
  const now = new Date();

  const current = await prisma.studentLectureProgress.findUnique({ where: { lectureId_studentId: { lectureId, studentId } } });
  const alreadyCompleted = current?.status === "COMPLETED";
  const shouldComplete = !alreadyCompleted && watchPercent >= AUTO_COMPLETE_WATCH_PERCENT;

  await prisma.studentLectureProgress.upsert({
    where: { lectureId_studentId: { lectureId, studentId } },
    create: {
      schoolId,
      lectureId,
      studentId,
      status: shouldComplete ? "COMPLETED" : "IN_PROGRESS",
      firstOpenedAt: now,
      lastAccessedAt: now,
      lastVideoPositionSeconds: Math.floor(positionSeconds),
      videoDurationSeconds: Math.floor(durationSeconds),
      watchPercent,
      progressPercent: shouldComplete ? 100 : watchPercent,
      completedAt: shouldComplete ? now : null,
    },
    update: {
      lastAccessedAt: now,
      lastVideoPositionSeconds: Math.floor(positionSeconds),
      videoDurationSeconds: Math.floor(durationSeconds),
      watchPercent,
      ...(alreadyCompleted
        ? {}
        : {
            status: shouldComplete ? "COMPLETED" : "IN_PROGRESS",
            progressPercent: shouldComplete ? 100 : watchPercent,
            completedAt: shouldComplete ? now : undefined,
          }),
    },
  });
}

/// For written/PDF/document lectures with no meaningful playback signal —
/// an explicit "Mark as complete" action the student takes themselves.
export async function markLectureCompleteManually(schoolId: string, studentId: string, lectureId: string) {
  const lecture = await verifyStudentCanAccessLecture(schoolId, studentId, lectureId);
  if (!lecture) throw new Error("Lecture not found.");

  const now = new Date();
  await prisma.studentLectureProgress.upsert({
    where: { lectureId_studentId: { lectureId, studentId } },
    create: { schoolId, lectureId, studentId, status: "COMPLETED", firstOpenedAt: now, lastAccessedAt: now, completedAt: now, progressPercent: 100 },
    update: { status: "COMPLETED", lastAccessedAt: now, completedAt: now, progressPercent: 100 },
  });
}

export interface StudentProgressRow {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  progressPercent: number;
  firstOpenedAt: Date | null;
  lastAccessedAt: Date | null;
  completedAt: Date | null;
}

/// The teacher progress dashboard's data source (brief: "for every lecture,
/// teachers should see total/not-started/in-progress/completed/completion
/// rate"). Builds the full class roster first (every ACTIVE student in the
/// lecture's own classArm) and left-joins progress, so a student who never
/// opened the lecture still shows up as NOT_STARTED rather than being
/// invisible.
export async function getLectureProgressForTeacher(schoolId: string, teacherId: string, lectureId: string) {
  const lecture = await prisma.lecture.findFirst({ where: { schoolId, teacherId, id: lectureId } });
  if (!lecture) throw new Error("Lecture not found.");

  const [students, progressRows] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, classArmId: lecture.classArmId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.studentLectureProgress.findMany({ where: { schoolId, lectureId } }),
  ]);

  const progressByStudent = new Map(progressRows.map((p) => [p.studentId, p]));
  const rows: StudentProgressRow[] = students.map((s) => {
    const p = progressByStudent.get(s.id);
    return {
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      status: p?.status ?? "NOT_STARTED",
      progressPercent: p?.progressPercent ?? 0,
      firstOpenedAt: p?.firstOpenedAt ?? null,
      lastAccessedAt: p?.lastAccessedAt ?? null,
      completedAt: p?.completedAt ?? null,
    };
  });

  const total = rows.length;
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
  const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { lecture, rows, summary: { total, completed, inProgress, notStarted, completionRate } };
}

/// Overall (across every published lecture) completion summary shown on the
/// student's own learning dashboard.
export async function getStudentLearningSummary(schoolId: string, studentId: string) {
  const lectures = await listLecturesForStudent(schoolId, studentId);
  const total = lectures.length;
  const completed = lectures.filter((l) => l.progress[0]?.status === "COMPLETED").length;
  const inProgress = lectures.filter((l) => l.progress[0]?.status === "IN_PROGRESS").length;
  const notStarted = total - completed - inProgress;
  return { lectures, total, completed, inProgress, notStarted };
}

// ---------------------------------------------------------------------------
// Admin / school-wide monitoring (permissions.ONLINE_LEARNING_VIEW_ALL) —
// deliberately separate from the teacher-scoped functions above rather than
// an optional "bypass" flag on them, so a missing permission check can never
// accidentally widen a teacher-facing query to the whole school.
// ---------------------------------------------------------------------------

export async function listAllLecturesForSchool(schoolId: string, filters: LectureListFilters = {}) {
  return prisma.lecture.findMany({
    where: {
      schoolId,
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.classArmId ? { classArmId: filters.classArmId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      subject: true,
      classArm: { include: { classGroup: true } },
      teacher: { select: { id: true, name: true } },
      _count: { select: { resources: true, progress: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOnlineLearningOverview(schoolId: string) {
  const [
    totalLectures,
    publishedLectures,
    activeTeacherIds,
    learningStudentIds,
    progressAgg,
    upcomingLiveClasses,
    liveClassesHeld,
    attendanceAgg,
  ] = await Promise.all([
    prisma.lecture.count({ where: { schoolId } }),
    prisma.lecture.count({ where: { schoolId, status: "PUBLISHED" } }),
    prisma.lecture.findMany({ where: { schoolId }, distinct: ["teacherId"], select: { teacherId: true } }),
    prisma.studentLectureProgress.findMany({ where: { schoolId }, distinct: ["studentId"], select: { studentId: true } }),
    prisma.studentLectureProgress.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
    prisma.liveClass.count({ where: { schoolId, status: "SCHEDULED" } }),
    prisma.liveClass.count({ where: { schoolId, status: "COMPLETED" } }),
    prisma.liveClassAttendance.groupBy({ by: ["status"], where: { schoolId, liveClass: { status: "COMPLETED" } }, _count: true }),
  ]);

  const completed = progressAgg.find((g) => g.status === "COMPLETED")?._count ?? 0;
  const totalTracked = progressAgg.reduce((sum, g) => sum + g._count, 0);
  const averageCompletionRate = totalTracked > 0 ? Math.round((completed / totalTracked) * 100) : 0;

  const attended = attendanceAgg.find((g) => g.status === "ATTENDED")?._count ?? 0;
  const totalAttendanceRows = attendanceAgg.reduce((sum, g) => sum + g._count, 0);
  const liveClassAttendanceRate = totalAttendanceRows > 0 ? Math.round((attended / totalAttendanceRows) * 100) : 0;

  return {
    totalLectures,
    publishedLectures,
    activeTeachers: activeTeacherIds.length,
    studentsLearning: learningStudentIds.length,
    averageCompletionRate,
    upcomingLiveClasses,
    liveClassesHeld,
    liveClassAttendanceRate,
  };
}

/// One row per teacher who has created at least one lecture or live class —
/// the "Teacher Activity" admin report.
export async function getTeacherActivityReport(schoolId: string) {
  const teachers = await prisma.user.findMany({
    where: { schoolId, role: { key: "TEACHER" } },
    select: {
      id: true,
      name: true,
      _count: { select: { lecturesCreated: true, liveClassesCreated: true } },
    },
    orderBy: { name: "asc" },
  });

  const [publishedByTeacher, liveByTeacher] = await Promise.all([
    prisma.lecture.groupBy({ by: ["teacherId"], where: { schoolId, status: "PUBLISHED" }, _count: true }),
    prisma.liveClass.groupBy({ by: ["teacherId"], where: { schoolId, status: "COMPLETED" }, _count: true }),
  ]);
  const publishedMap = new Map(publishedByTeacher.map((r) => [r.teacherId, r._count]));
  const liveMap = new Map(liveByTeacher.map((r) => [r.teacherId, r._count]));

  return teachers.map((t) => ({
    teacherId: t.id,
    name: t.name,
    totalLectures: t._count.lecturesCreated,
    publishedLectures: publishedMap.get(t.id) ?? 0,
    totalLiveClasses: t._count.liveClassesCreated,
    completedLiveClasses: liveMap.get(t.id) ?? 0,
  }));
}

/// One row per student with at least one lecture-progress record — the
/// "Student Engagement" admin report.
export async function getStudentEngagementReport(schoolId: string) {
  const rows = await prisma.studentLectureProgress.groupBy({
    by: ["studentId"],
    where: { schoolId },
    _count: true,
  });
  const studentIds = rows.map((r) => r.studentId);
  if (studentIds.length === 0) return [];

  const [students, completedByStudent] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, classArm: { include: { classGroup: true } } },
    }),
    prisma.studentLectureProgress.groupBy({ by: ["studentId"], where: { schoolId, status: "COMPLETED" }, _count: true }),
  ]);
  const completedMap = new Map(completedByStudent.map((r) => [r.studentId, r._count]));
  const engagedMap = new Map(rows.map((r) => [r.studentId, r._count]));

  return students
    .map((s) => ({
      studentId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      className: s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "Unassigned",
      lecturesEngaged: engagedMap.get(s.id) ?? 0,
      lecturesCompleted: completedMap.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.lecturesCompleted - a.lecturesCompleted);
}
