"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { setupAcademicStructure } from "@/lib/services/academics";

const schema = z.object({
  sessionName: z.string().trim().min(4, "e.g. 2026/2027"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  classNames: z.string().trim().min(1, "Add at least one class"),
  subjectNames: z.string().trim().optional().or(z.literal("")),
});

export interface AcademicStructureState {
  status: "idle" | "error";
  message?: string;
}

export async function saveAcademicStructure(
  _prev: AcademicStructureState,
  formData: FormData
): Promise<AcademicStructureState> {
  const user = await requireSchoolUser();

  const parsed = schema.safeParse({
    sessionName: formData.get("sessionName"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    classNames: formData.get("classNames"),
    subjectNames: formData.get("subjectNames") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  if (parsed.data.endDate <= parsed.data.startDate) {
    return { status: "error", message: "End date must be after the start date." };
  }

  await setupAcademicStructure(user.schoolId, {
    sessionName: parsed.data.sessionName,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    classNames: parsed.data.classNames,
    subjectNames: parsed.data.subjectNames || "",
  });

  redirect("/onboarding/invite-staff");
}
