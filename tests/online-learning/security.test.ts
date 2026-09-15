import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createLecture, publishLecture, listLecturesForStudent, listLecturesForTeacher, getLectureProgressForTeacher, updateVideoProgress, markLectureCompleteManually } from "@/lib/services/lectures";
import { scheduleLiveClass, listLiveClassesForStudent, getStudentLiveClassAccess, cancelLiveClass, endLiveClass, getLiveClassAttendanceForTeacher, sendClassroomMessage } from "@/lib/services/live-classes";
import { cleanupTestSchools } from "../helpers/factories";

afterAll(cleanupTestSchools);

let counter = 0;
function uniqueSlug(label: string) {
  counter += 1;
  return `vitest-ol-${label}-${Date.now()}-${counter}`;
}

/// Builds a full school with one teacher assigned to Mathematics/JSS 2 A,
/// and `studentCount` ACTIVE students enrolled in that same class arm — the
/// exact shape the brief's cross-school test scenario describes (two
/// schools, each with their own distinct "JSS 2A" class).
async function makeSchoolFixture(label: string, studentNames: string[]) {
  const slug = uniqueSlug(label);
  const school = await prisma.school.create({ data: { name: slug, slug, status: "ACTIVE" } });
  const role = await prisma.role.create({ data: { schoolId: school.id, key: "TEACHER", name: "Teacher" } });
  const teacher = await prisma.user.create({
    data: { schoolId: school.id, roleId: role.id, email: `${slug}-teacher@vitest.local`, passwordHash: "x", name: `Teacher ${label}` },
  });
  const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathematics", code: "MTH" } });
  const session = await prisma.academicSession.create({
    data: { schoolId: school.id, name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const term = await prisma.term.create({
    data: { schoolId: school.id, academicSessionId: session.id, name: "First Term", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true },
  });
  const classGroup = await prisma.classGroup.create({ data: { schoolId: school.id, name: "JSS 2", order: 0 } });
  const classArm = await prisma.classArm.create({ data: { schoolId: school.id, classGroupId: classGroup.id, name: "A" } });
  await prisma.teacherAssignment.create({ data: { schoolId: school.id, teacherId: teacher.id, subjectId: subject.id, classArmId: classArm.id } });

  const students = [];
  for (const name of studentNames) {
    students.push(
      await prisma.student.create({
        data: {
          schoolId: school.id,
          classArmId: classArm.id,
          firstName: name,
          lastName: "Student",
          admissionNumber: `${slug}-${name}`,
          status: "ACTIVE",
        },
      })
    );
  }

  return { school, teacher, subject, session, term, classGroup, classArm, students };
}

describe("Online Learning: multi-school isolation", () => {
  it("students only see lectures published for their own school's class — never another school's same-named class", async () => {
    const schoolA = await makeSchoolFixture("A", ["John", "Mary", "Peter"]);
    const schoolB = await makeSchoolFixture("B", ["David", "Grace"]);
    const [john, mary, peter] = schoolA.students;
    const [david, grace] = schoolB.students;

    const lecture = await createLecture(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Introduction to Algebra",
      resources: [],
    });
    await publishLecture(schoolA.school.id, schoolA.teacher.id, lecture.id);

    for (const student of [john, mary, peter]) {
      const visible = await listLecturesForStudent(schoolA.school.id, student.id);
      expect(visible.map((l) => l.id)).toContain(lecture.id);
    }

    for (const student of [david, grace]) {
      const visible = await listLecturesForStudent(schoolB.school.id, student.id);
      expect(visible.map((l) => l.id)).not.toContain(lecture.id);
    }
  });

  it("a draft lecture is visible to its teacher but never to students", async () => {
    const schoolA = await makeSchoolFixture("draft", ["John"]);
    const [john] = schoolA.students;

    const lecture = await createLecture(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Unpublished draft",
      resources: [],
    });

    const teacherView = await listLecturesForTeacher(schoolA.school.id, schoolA.teacher.id);
    expect(teacherView.map((l) => l.id)).toContain(lecture.id);

    const studentView = await listLecturesForStudent(schoolA.school.id, john.id);
    expect(studentView.map((l) => l.id)).not.toContain(lecture.id);
  });

  it("a teacher cannot create a lecture for a subject/class they are not assigned to", async () => {
    const schoolA = await makeSchoolFixture("unassigned", []);
    const otherSubject = await prisma.subject.create({ data: { schoolId: schoolA.school.id, name: "Physics", code: "PHY" } });

    await expect(
      createLecture(schoolA.school.id, schoolA.teacher.id, {
        subjectId: otherSubject.id,
        classArmId: schoolA.classArm.id,
        academicSessionId: schoolA.session.id,
        termId: schoolA.term.id,
        title: "Should be rejected",
        resources: [],
      })
    ).rejects.toThrow(/not assigned/i);
  });

  it("students only see live classes scheduled for their own school's class", async () => {
    const schoolA = await makeSchoolFixture("live-A", ["John", "Mary"]);
    const schoolB = await makeSchoolFixture("live-B", ["David", "Grace"]);
    const [john, mary] = schoolA.students;
    const [david, grace] = schoolB.students;

    const liveClass = await scheduleLiveClass(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra Revision",
      scheduledStart: new Date(Date.now() + 3600_000),
      durationMinutes: 40,
    });

    for (const student of [john, mary]) {
      const visible = await listLiveClassesForStudent(schoolA.school.id, student.id);
      expect(visible.map((l) => l.id)).toContain(liveClass.id);
    }
    for (const student of [david, grace]) {
      const visible = await listLiveClassesForStudent(schoolB.school.id, student.id);
      expect(visible.map((l) => l.id)).not.toContain(liveClass.id);
    }
  });

  it("rejects a cross-school student's attempt to access another school's live classroom", async () => {
    const schoolA = await makeSchoolFixture("access-A", ["John"]);
    const schoolB = await makeSchoolFixture("access-B", ["David"]);
    const [david] = schoolB.students;

    const liveClass = await scheduleLiveClass(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra Revision",
      scheduledStart: new Date(Date.now() + 3600_000),
      durationMinutes: 40,
    });

    // David manually guesses School A's live class id, scoped to his own
    // school — the backend must reject this the same way it would a
    // nonexistent id, never leaking that the row exists elsewhere.
    const access = await getStudentLiveClassAccess(schoolB.school.id, david.id, liveClass.id);
    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.reason).toBe("not_found");

    await expect(sendClassroomMessage(schoolB.school.id, david.id, "student", liveClass.id, "hi")).rejects.toThrow();
  });

  it("rejects a same-school student from a different class from joining", async () => {
    const schoolA = await makeSchoolFixture("wrongclass", ["John"]);
    const [john] = schoolA.students;
    const otherClassGroup = await prisma.classGroup.create({ data: { schoolId: schoolA.school.id, name: "JSS 3", order: 1 } });
    const otherClassArm = await prisma.classArm.create({ data: { schoolId: schoolA.school.id, classGroupId: otherClassGroup.id, name: "B" } });
    const peterElsewhere = await prisma.student.create({
      data: { schoolId: schoolA.school.id, classArmId: otherClassArm.id, firstName: "Peter", lastName: "Elsewhere", admissionNumber: "elsewhere-1", status: "ACTIVE" },
    });

    const liveClass = await scheduleLiveClass(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra Revision",
      scheduledStart: new Date(Date.now() + 3600_000),
      durationMinutes: 40,
    });

    // John is in the right class — eligible, just not open yet (scheduled
    // an hour out, 15-minute join window).
    const johnAccess = await getStudentLiveClassAccess(schoolA.school.id, john.id, liveClass.id);
    expect(johnAccess.ok).toBe(false);
    if (!johnAccess.ok) expect(johnAccess.reason).toBe("not_open_yet");

    const peterAccess = await getStudentLiveClassAccess(schoolA.school.id, peterElsewhere.id, liveClass.id);
    expect(peterAccess.ok).toBe(false);
    if (!peterAccess.ok) expect(peterAccess.reason).toBe("not_found");
  });

  it("a teacher cannot cancel another school's live class", async () => {
    const schoolA = await makeSchoolFixture("cancel-A", []);
    const schoolB = await makeSchoolFixture("cancel-B", []);

    const liveClass = await scheduleLiveClass(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra Revision",
      scheduledStart: new Date(Date.now() + 3600_000),
      durationMinutes: 40,
    });

    await expect(cancelLiveClass(schoolB.school.id, schoolB.teacher.id, liveClass.id)).rejects.toThrow(/not found/i);
  });
});

describe("Online Learning: lecture progress tracking", () => {
  it("tracks not-started, in-progress and completed correctly across students", async () => {
    const schoolA = await makeSchoolFixture("progress", ["John", "Mary", "Peter"]);
    const [john, mary] = schoolA.students;

    const lecture = await createLecture(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Introduction to Algebra",
      resources: [],
    });
    await publishLecture(schoolA.school.id, schoolA.teacher.id, lecture.id);

    // John completes it explicitly (a written lesson, no video signal).
    await markLectureCompleteManually(schoolA.school.id, john.id, lecture.id);
    // Mary watches half of a 20-minute video — 50%, below the 80% auto-
    // complete threshold, so she stays IN_PROGRESS.
    await updateVideoProgress(schoolA.school.id, mary.id, lecture.id, 600, 1200);
    // Peter never opens it.

    const { rows, summary } = await getLectureProgressForTeacher(schoolA.school.id, schoolA.teacher.id, lecture.id);
    const byName = new Map(rows.map((r) => [r.firstName, r]));

    expect(byName.get("John")?.status).toBe("COMPLETED");
    expect(byName.get("Mary")?.status).toBe("IN_PROGRESS");
    expect(byName.get("Mary")?.progressPercent).toBe(50);
    expect(byName.get("Peter")?.status).toBe("NOT_STARTED");
    expect(summary).toEqual({ total: 3, completed: 1, inProgress: 1, notStarted: 1, completionRate: 33 });
  });

  it("auto-completes a video lecture once watch percentage crosses 80%", async () => {
    const schoolA = await makeSchoolFixture("autocomplete", ["John"]);
    const [john] = schoolA.students;
    const lecture = await createLecture(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra video",
      resources: [],
    });
    await publishLecture(schoolA.school.id, schoolA.teacher.id, lecture.id);

    await updateVideoProgress(schoolA.school.id, john.id, lecture.id, 900, 1800); // 50% — not yet
    let progress = await prisma.studentLectureProgress.findUnique({ where: { lectureId_studentId: { lectureId: lecture.id, studentId: john.id } } });
    expect(progress?.status).toBe("IN_PROGRESS");

    await updateVideoProgress(schoolA.school.id, john.id, lecture.id, 1500, 1800); // ~83%
    progress = await prisma.studentLectureProgress.findUnique({ where: { lectureId_studentId: { lectureId: lecture.id, studentId: john.id } } });
    expect(progress?.status).toBe("COMPLETED");
    expect(progress?.completedAt).not.toBeNull();
  });
});

describe("Online Learning: live class attendance", () => {
  it("records join/leave time and computes ATTENDED once minimum presence is met", async () => {
    const schoolA = await makeSchoolFixture("attendance", ["John"]);
    const [john] = schoolA.students;

    const liveClass = await scheduleLiveClass(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra Revision",
      scheduledStart: new Date(Date.now() - 3600_000),
      durationMinutes: 60,
    });
    // Simulate the class actually having gone live (bypasses the
    // LiveKit-configured guard in startLiveClass — this test is about
    // attendance math, not infra availability).
    await prisma.liveClass.update({ where: { id: liveClass.id }, data: { status: "LIVE", startedAt: new Date(Date.now() - 3600_000) } });

    const joinedAt = new Date(Date.now() - 3600_000 + 60_000); // joined 1 min in
    const leftAt = new Date(joinedAt.getTime() + 53 * 60_000); // present 53 minutes of a 60-minute class
    // scheduleLiveClass already created this row (ABSENT default, via
    // syncAttendanceRoster) — update it to simulate the join, same as
    // mintStudentClassroomToken would in the real join path.
    const attendance = await prisma.liveClassAttendance.update({
      where: { liveClassId_studentId: { liveClassId: liveClass.id, studentId: john.id } },
      data: { firstJoinedAt: joinedAt, status: "JOINED" },
    });
    await prisma.liveClassAttendanceSegment.create({ data: { attendanceId: attendance.id, joinedAt, leftAt } });

    await endLiveClass(schoolA.school.id, schoolA.teacher.id, liveClass.id);

    const rows = await getLiveClassAttendanceForTeacher(schoolA.school.id, schoolA.teacher.id, liveClass.id);
    const johnRow = rows.find((r) => r.studentId === john.id)!;
    expect(johnRow.status).toBe("ATTENDED");
    expect(johnRow.totalConnectedSeconds).toBeGreaterThanOrEqual(53 * 60 - 5);
    expect(johnRow.lastLeftAt).not.toBeNull();
  });

  it("preserves cumulative presence across a disconnect and reconnect, and marks a no-show ABSENT", async () => {
    const schoolA = await makeSchoolFixture("reconnect", ["Mary", "Peter"]);
    const [mary, peter] = schoolA.students;

    const liveClass = await scheduleLiveClass(schoolA.school.id, schoolA.teacher.id, {
      subjectId: schoolA.subject.id,
      classArmId: schoolA.classArm.id,
      academicSessionId: schoolA.session.id,
      termId: schoolA.term.id,
      title: "Algebra Revision",
      scheduledStart: new Date(Date.now() - 3600_000),
      durationMinutes: 60,
    });
    await prisma.liveClass.update({ where: { id: liveClass.id }, data: { status: "LIVE", startedAt: new Date(Date.now() - 3600_000) } });

    // Mary joins, disconnects for a few minutes, then reconnects — total
    // presence across both segments stays well under the 70% (42 min)
    // threshold for a 60-minute class, so she should land on LEFT_EARLY,
    // not lose her earlier segment's time.
    const start = new Date(Date.now() - 3600_000);
    const attendance = await prisma.liveClassAttendance.update({
      where: { liveClassId_studentId: { liveClassId: liveClass.id, studentId: mary.id } },
      data: { firstJoinedAt: start, status: "JOINED" },
    });
    await prisma.liveClassAttendanceSegment.create({
      data: { attendanceId: attendance.id, joinedAt: start, leftAt: new Date(start.getTime() + 10 * 60_000) },
    });
    await prisma.liveClassAttendanceSegment.create({
      data: { attendanceId: attendance.id, joinedAt: new Date(start.getTime() + 15 * 60_000), leftAt: new Date(start.getTime() + 20 * 60_000) },
    });

    // Peter never joins at all — his roster row was created ABSENT at
    // schedule time (syncAttendanceRoster) and nothing ever changes it.

    await endLiveClass(schoolA.school.id, schoolA.teacher.id, liveClass.id);

    const rows = await getLiveClassAttendanceForTeacher(schoolA.school.id, schoolA.teacher.id, liveClass.id);
    const maryRow = rows.find((r) => r.studentId === mary.id)!;
    const peterRow = rows.find((r) => r.studentId === peter.id)!;

    expect(maryRow.totalConnectedSeconds).toBeGreaterThanOrEqual(15 * 60 - 5);
    expect(maryRow.status).toBe("LEFT_EARLY");
    expect(peterRow.status).toBe("ABSENT");
    expect(peterRow.totalConnectedSeconds).toBe(0);
  });
});
