import "server-only";
import { prisma } from "@/lib/db";
import type { DayOfWeek } from "@/generated/prisma/client";

export const DAYS_OF_WEEK: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function listSlotsForClassArm(schoolId: string, classArmId: string) {
  return prisma.timetableSlot.findMany({
    where: { schoolId, classArmId },
    include: { subject: true, teacher: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

export async function listSlotsForTeacher(schoolId: string, teacherId: string) {
  return prisma.timetableSlot.findMany({
    where: { schoolId, teacherId },
    include: { subject: true, classArm: { include: { classGroup: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

export interface TimetableSlotInput {
  classArmId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export async function createTimetableSlot(schoolId: string, input: TimetableSlotInput) {
  if (input.startTime >= input.endTime) {
    throw new Error("End time must be after start time.");
  }

  const [classConflicts, teacherConflicts] = await Promise.all([
    prisma.timetableSlot.findMany({ where: { schoolId, classArmId: input.classArmId, dayOfWeek: input.dayOfWeek } }),
    prisma.timetableSlot.findMany({ where: { schoolId, teacherId: input.teacherId, dayOfWeek: input.dayOfWeek } }),
  ]);

  const classClash = classConflicts.find((s) => overlaps(input.startTime, input.endTime, s.startTime, s.endTime));
  if (classClash) throw new Error(`This class already has a period at ${classClash.startTime}-${classClash.endTime} that day.`);

  const teacherClash = teacherConflicts.find((s) => overlaps(input.startTime, input.endTime, s.startTime, s.endTime));
  if (teacherClash) throw new Error(`This teacher already has a period at ${teacherClash.startTime}-${teacherClash.endTime} that day.`);

  return prisma.timetableSlot.create({ data: { schoolId, ...input } });
}

export async function deleteTimetableSlot(schoolId: string, id: string) {
  const existing = await prisma.timetableSlot.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Timetable slot not found");
  await prisma.timetableSlot.delete({ where: { id } });
}
