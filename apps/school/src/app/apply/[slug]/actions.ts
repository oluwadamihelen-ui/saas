"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  submitApplication,
  markApplicationFeePendingConfirmation,
  initiateApplicationFeePayment,
  confirmApplicationFeeOnlinePayment,
  getSchoolBySlug,
} from "@/lib/services/admission";

async function currentOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export interface ApplyFormState {
  status: "idle" | "error";
  message?: string;
}

const applySchema = z.object({
  childFirstName: z.string().trim().min(1, "Enter the child's first name"),
  childLastName: z.string().trim().min(1, "Enter the child's last name"),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", ""]).optional(),
  desiredClassGroupId: z.string().trim().optional().or(z.literal("")),
  parentName: z.string().trim().min(1, "Enter your name"),
  parentEmail: z.string().trim().email("Enter a valid email"),
  parentPhone: z.string().trim().min(1, "Enter a phone number"),
  addressLine: z.string().trim().optional().or(z.literal("")),
});

export async function submitApplicationAction(slug: string, _prev: ApplyFormState, formData: FormData): Promise<ApplyFormState> {
  const school = await getSchoolBySlug(slug);
  if (!school) return { status: "error", message: "This school could not be found." };

  const parsed = applySchema.safeParse({
    childFirstName: formData.get("childFirstName"),
    childLastName: formData.get("childLastName"),
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    gender: formData.get("gender") ?? "",
    desiredClassGroupId: formData.get("desiredClassGroupId") ?? "",
    parentName: formData.get("parentName"),
    parentEmail: formData.get("parentEmail"),
    parentPhone: formData.get("parentPhone"),
    addressLine: formData.get("addressLine") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  const applicant = await submitApplication(school.id, {
    childFirstName: parsed.data.childFirstName,
    childLastName: parsed.data.childLastName,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
    gender: parsed.data.gender || null,
    desiredClassGroupId: parsed.data.desiredClassGroupId || null,
    parentName: parsed.data.parentName,
    parentEmail: parsed.data.parentEmail,
    parentPhone: parsed.data.parentPhone,
    addressLine: parsed.data.addressLine || null,
  });

  redirect(`/apply/${slug}/${applicant.id}`);
}

export async function payApplicationFeeOnlineAction(slug: string, applicantId: string, _prev: ApplyFormState, _formData: FormData): Promise<ApplyFormState> {
  const school = await getSchoolBySlug(slug);
  if (!school) return { status: "error", message: "This school could not be found." };

  let authorizationUrl: string;
  try {
    const origin = await currentOrigin();
    const result = await initiateApplicationFeePayment(school.id, applicantId, `${origin}/apply/${slug}/${applicantId}/confirm`);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not start payment." };
  }
  redirect(authorizationUrl);
}

export async function confirmApplicationFeeOnlineAction(reference: string) {
  await confirmApplicationFeeOnlinePayment(reference);
}

export async function notifyApplicationFeeTransferAction(slug: string, applicantId: string, _prev: ApplyFormState, _formData: FormData): Promise<ApplyFormState> {
  const school = await getSchoolBySlug(slug);
  if (!school) return { status: "error", message: "This school could not be found." };

  try {
    await markApplicationFeePendingConfirmation(school.id, applicantId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not record your notice." };
  }
  redirect(`/apply/${slug}/${applicantId}`);
}
