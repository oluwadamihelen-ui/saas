"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { submitApplicationSchema, submitApplication } from "@/lib/services/developer-applications";

export interface SubmitApplicationState {
  status: "idle" | "error";
  message?: string;
}

export async function submitApplicationAction(_prev: SubmitApplicationState, formData: FormData): Promise<SubmitApplicationState> {
  const user = await requireRole("DEVELOPER");

  const parsed = submitApplicationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    fullDescription: formData.get("fullDescription"),
    licensePrice: formData.get("licensePrice"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  let applicationId: string;
  try {
    const application = await submitApplication(user.id, parsed.data);
    applicationId = application.id;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not submit this application." };
  }

  redirect(`/dashboard/developer/apps/${applicationId}`);
}
