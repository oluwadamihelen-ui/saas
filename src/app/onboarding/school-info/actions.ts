"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { updateSchoolInfo } from "@/lib/services/school";

const schema = z.object({
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().min(1),
  currency: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
});

export interface SchoolInfoState {
  status: "idle" | "error";
  message?: string;
}

export async function saveSchoolInfo(_prev: SchoolInfoState, formData: FormData): Promise<SchoolInfoState> {
  const user = await requireSchoolUser();

  const parsed = schema.safeParse({
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    country: formData.get("country"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  await updateSchoolInfo(user.schoolId, {
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    website: parsed.data.website || null,
    addressLine: parsed.data.addressLine || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
  });

  redirect("/onboarding/academic-structure");
}
