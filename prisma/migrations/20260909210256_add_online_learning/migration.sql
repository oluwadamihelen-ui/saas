-- CreateEnum
CREATE TYPE "LectureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LectureResourceType" AS ENUM ('VIDEO', 'AUDIO', 'WRITTEN', 'PDF', 'WORD_DOCUMENT', 'PRESENTATION', 'IMAGE', 'EXTERNAL_LINK');

-- CreateEnum
CREATE TYPE "LectureProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LiveClassStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveClassAttendanceStatus" AS ENUM ('JOINED', 'ATTENDED', 'LEFT_EARLY', 'ABSENT');

-- CreateEnum
CREATE TYPE "LiveClassRecordingStatus" AS ENUM ('RECORDING', 'PROCESSING', 'AVAILABLE', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LECTURE_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_CLASS_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_CLASS_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_CLASS_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_CLASS_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'LIVE_CLASS_RECORDING_AVAILABLE';

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "description" TEXT,
    "learningObjectives" TEXT,
    "instructions" TEXT,
    "status" "LectureStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureResource" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "type" "LectureResourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "writtenContent" TEXT,
    "fileSizeBytes" INTEGER,
    "durationSeconds" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLectureProgress" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "LectureProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "lastVideoPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "videoDurationSeconds" INTEGER,
    "watchPercent" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLectureProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "description" TEXT,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "maxParticipants" INTEGER,
    "joinWindowMinutesBefore" INTEGER NOT NULL DEFAULT 15,
    "status" "LiveClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "roomName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstJoinedAt" TIMESTAMP(3),
    "lastLeftAt" TIMESTAMP(3),
    "totalConnectedSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" "LiveClassAttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "handRaised" BOOLEAN NOT NULL DEFAULT false,
    "micMuted" BOOLEAN NOT NULL DEFAULT true,
    "cameraOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClassAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassAttendanceSegment" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "LiveClassAttendanceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMessage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClassRecording" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "status" "LiveClassRecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "storageProvider" TEXT,
    "storageKey" TEXT,
    "fileUrl" TEXT,
    "initiatedById" TEXT NOT NULL,
    "publishedAsLectureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lecture_schoolId_idx" ON "Lecture"("schoolId");

-- CreateIndex
CREATE INDEX "Lecture_schoolId_classArmId_status_idx" ON "Lecture"("schoolId", "classArmId", "status");

-- CreateIndex
CREATE INDEX "Lecture_schoolId_subjectId_idx" ON "Lecture"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "Lecture_schoolId_teacherId_idx" ON "Lecture"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "LectureResource_lectureId_idx" ON "LectureResource"("lectureId");

-- CreateIndex
CREATE INDEX "StudentLectureProgress_schoolId_idx" ON "StudentLectureProgress"("schoolId");

-- CreateIndex
CREATE INDEX "StudentLectureProgress_schoolId_studentId_idx" ON "StudentLectureProgress"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentLectureProgress_lectureId_idx" ON "StudentLectureProgress"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLectureProgress_lectureId_studentId_key" ON "StudentLectureProgress"("lectureId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClass_roomName_key" ON "LiveClass"("roomName");

-- CreateIndex
CREATE INDEX "LiveClass_schoolId_idx" ON "LiveClass"("schoolId");

-- CreateIndex
CREATE INDEX "LiveClass_schoolId_classArmId_status_idx" ON "LiveClass"("schoolId", "classArmId", "status");

-- CreateIndex
CREATE INDEX "LiveClass_schoolId_teacherId_idx" ON "LiveClass"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "LiveClass_schoolId_status_scheduledStart_idx" ON "LiveClass"("schoolId", "status", "scheduledStart");

-- CreateIndex
CREATE INDEX "LiveClassAttendance_schoolId_idx" ON "LiveClassAttendance"("schoolId");

-- CreateIndex
CREATE INDEX "LiveClassAttendance_liveClassId_idx" ON "LiveClassAttendance"("liveClassId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassAttendance_liveClassId_studentId_key" ON "LiveClassAttendance"("liveClassId", "studentId");

-- CreateIndex
CREATE INDEX "LiveClassAttendanceSegment_attendanceId_idx" ON "LiveClassAttendanceSegment"("attendanceId");

-- CreateIndex
CREATE INDEX "ClassroomMessage_liveClassId_idx" ON "ClassroomMessage"("liveClassId");

-- CreateIndex
CREATE INDEX "ClassroomMessage_schoolId_idx" ON "ClassroomMessage"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClassRecording_publishedAsLectureId_key" ON "LiveClassRecording"("publishedAsLectureId");

-- CreateIndex
CREATE INDEX "LiveClassRecording_liveClassId_idx" ON "LiveClassRecording"("liveClassId");

-- CreateIndex
CREATE INDEX "LiveClassRecording_schoolId_idx" ON "LiveClassRecording"("schoolId");

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureResource" ADD CONSTRAINT "LectureResource_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLectureProgress" ADD CONSTRAINT "StudentLectureProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLectureProgress" ADD CONSTRAINT "StudentLectureProgress_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLectureProgress" ADD CONSTRAINT "StudentLectureProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAttendance" ADD CONSTRAINT "LiveClassAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAttendance" ADD CONSTRAINT "LiveClassAttendance_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAttendance" ADD CONSTRAINT "LiveClassAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassAttendanceSegment" ADD CONSTRAINT "LiveClassAttendanceSegment_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "LiveClassAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassRecording" ADD CONSTRAINT "LiveClassRecording_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassRecording" ADD CONSTRAINT "LiveClassRecording_liveClassId_fkey" FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassRecording" ADD CONSTRAINT "LiveClassRecording_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveClassRecording" ADD CONSTRAINT "LiveClassRecording_publishedAsLectureId_fkey" FOREIGN KEY ("publishedAsLectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
