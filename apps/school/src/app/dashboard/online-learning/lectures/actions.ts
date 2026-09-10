"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createLecture,
  updateLecture,
  publishLecture,
  archiveLecture,
  unpublishLectureToDraft,
  deleteDraftLecture,
  type LectureInput,
  type LectureResourceInput,
} from "@/lib/services/lectures";
import { uploadOnlineLearningFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { LectureFormState } from "./lecture-form";

const lectureSchema = z.object({
  subjectClassKey: z.string().trim().min(1, "Select a subject and class"),
  termId: z.string().trim().min(1, "Select a term"),
  weekNumber: z.coerce.number().int().min(1).max(52).optional().or(z.literal("")),
  title: z.string().trim().min(1, "Title is required").max(200),
  topic: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  learningObjectives: z.string().trim().max(5000).optional().or(z.literal("")),
  instructions: z.string().trim().max(5000).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500MB — generous enough for a recorded lecture video

async function extractResources(schoolId: string, formData: FormData): Promise<{ resources: LectureResourceInput[]; error?: string }> {
  const keys = String(formData.get("resourceKeys") ?? "").split(",").filter(Boolean);
  const resources: LectureResourceInput[] = [];

  for (const key of keys) {
    const type = String(formData.get(`resource_type_${key}`) ?? "") as LectureResourceInput["type"];
    const title = String(formData.get(`resource_title_${key}`) ?? "").trim();
    if (!title) continue;

    if (type === "EXTERNAL_LINK") {
      const externalUrl = String(formData.get(`resource_externalUrl_${key}`) ?? "").trim();
      if (!externalUrl) return { resources: [], error: `Enter a URL for "${title}".` };
      resources.push({ type, title, externalUrl });
      continue;
    }

    if (type === "WRITTEN") {
      const writtenContent = String(formData.get(`resource_written_${key}`) ?? "").trim();
      if (!writtenContent) return { resources: [], error: `Enter the lesson content for "${title}".` };
      resources.push({ type, title, writtenContent });
      continue;
    }

    const file = formData.get(`resource_file_${key}`);
    const existingFileUrl = formData.get(`resource_existingFileUrl_${key}`);
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return { resources: [], error: `"${title}" is too large (max 500MB).` };
      try {
        const uploaded = await uploadOnlineLearningFile(schoolId, "lectures", file);
        resources.push({ type, title, fileUrl: uploaded.url, fileSizeBytes: uploaded.size });
      } catch (error) {
        return { resources: [], error: error instanceof Error ? error.message : `Could not upload "${title}".` };
      }
    } else if (typeof existingFileUrl === "string" && existingFileUrl) {
      resources.push({ type, title, fileUrl: existingFileUrl });
    } else {
      return { resources: [], error: `Attach a file for "${title}".` };
    }
  }

  return { resources };
}

async function buildLectureInput(schoolId: string, formData: FormData): Promise<{ input?: LectureInput; error?: string }> {
  const parsed = lectureSchema.safeParse({
    subjectClassKey: formData.get("subjectClassKey"),
    termId: formData.get("termId"),
    weekNumber: formData.get("weekNumber") || "",
    title: formData.get("title"),
    topic: formData.get("topic") ?? "",
    description: formData.get("description") ?? "",
    learningObjectives: formData.get("learningObjectives") ?? "",
    instructions: formData.get("instructions") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the lecture details." };
  }

  const [subjectId, classArmId] = parsed.data.subjectClassKey.split("|");
  if (!subjectId || !classArmId) return { error: "Select a subject and class." };

  const term = await prisma.term.findFirst({ where: { schoolId, id: parsed.data.termId } });
  if (!term) return { error: "Select a valid term." };

  const { resources, error: resourceError } = await extractResources(schoolId, formData);
  if (resourceError) return { error: resourceError };

  return {
    input: {
      subjectId,
      classArmId,
      academicSessionId: term.academicSessionId,
      termId: term.id,
      title: parsed.data.title,
      topic: parsed.data.topic || null,
      weekNumber: parsed.data.weekNumber ? Number(parsed.data.weekNumber) : null,
      description: parsed.data.description || null,
      learningObjectives: parsed.data.learningObjectives || null,
      instructions: parsed.data.instructions || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      resources,
    },
  };
}

export async function createLectureAction(_prev: LectureFormState, formData: FormData): Promise<LectureFormState> {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  const { input, error } = await buildLectureInput(user.schoolId, formData);
  if (error || !input) return { status: "error", message: error ?? "Please check the lecture details." };

  let lecture;
  try {
    lecture = await createLecture(user.schoolId, user.id, input);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Could not create this lecture." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "lecture.created", resourceType: "Lecture", resourceId: lecture.id, newValue: { title: lecture.title } });
  revalidatePath("/dashboard/online-learning/lectures");
  redirect(`/dashboard/online-learning/lectures/${lecture.id}`);
}

export async function updateLectureAction(lectureId: string, _prev: LectureFormState, formData: FormData): Promise<LectureFormState> {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  const { input, error } = await buildLectureInput(user.schoolId, formData);
  if (error || !input) return { status: "error", message: error ?? "Please check the lecture details." };

  try {
    await updateLecture(user.schoolId, user.id, lectureId, input);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Could not update this lecture." };
  }

  revalidatePath("/dashboard/online-learning/lectures");
  revalidatePath(`/dashboard/online-learning/lectures/${lectureId}`);
  redirect(`/dashboard/online-learning/lectures/${lectureId}`);
}

export async function publishLectureAction(lectureId: string) {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  await publishLecture(user.schoolId, user.id, lectureId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "lecture.published", resourceType: "Lecture", resourceId: lectureId });
  revalidatePath("/dashboard/online-learning/lectures");
  revalidatePath(`/dashboard/online-learning/lectures/${lectureId}`);
}

export async function archiveLectureAction(lectureId: string) {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  await archiveLecture(user.schoolId, user.id, lectureId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "lecture.archived", resourceType: "Lecture", resourceId: lectureId });
  revalidatePath("/dashboard/online-learning/lectures");
  revalidatePath(`/dashboard/online-learning/lectures/${lectureId}`);
}

export async function unpublishLectureAction(lectureId: string) {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  await unpublishLectureToDraft(user.schoolId, user.id, lectureId);
  revalidatePath("/dashboard/online-learning/lectures");
  revalidatePath(`/dashboard/online-learning/lectures/${lectureId}`);
}

export async function deleteDraftLectureAction(lectureId: string) {
  const user = await requirePermission(PERMISSIONS.LECTURES_MANAGE);
  await deleteDraftLecture(user.schoolId, user.id, lectureId);
  revalidatePath("/dashboard/online-learning/lectures");
  redirect("/dashboard/online-learning/lectures");
}
