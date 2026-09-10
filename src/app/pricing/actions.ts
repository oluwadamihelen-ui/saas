"use server";

import { z } from "zod";
import { createEnterpriseInquiry } from "@/lib/services/enterprise-inquiries";

export interface EnterpriseFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const inquirySchema = z.object({
  schoolOrGroupName: z.string().trim().min(1, "Enter your school or group's name"),
  contactName: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(1, "Enter a phone number"),
  studentCount: z.string().trim().optional().or(z.literal("")),
  campusCount: z.string().trim().optional().or(z.literal("")),
  currentSoftware: z.string().trim().max(200).optional().or(z.literal("")),
  requiredModules: z.string().trim().max(500).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function submitEnterpriseInquiryAction(_prev: EnterpriseFormState, formData: FormData): Promise<EnterpriseFormState> {
  const parsed = inquirySchema.safeParse({
    schoolOrGroupName: formData.get("schoolOrGroupName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    studentCount: formData.get("studentCount") ?? "",
    campusCount: formData.get("campusCount") ?? "",
    currentSoftware: formData.get("currentSoftware") ?? "",
    requiredModules: formData.get("requiredModules") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  await createEnterpriseInquiry({
    schoolOrGroupName: parsed.data.schoolOrGroupName,
    contactName: parsed.data.contactName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    studentCount: parsed.data.studentCount ? Number(parsed.data.studentCount) : null,
    campusCount: parsed.data.campusCount ? Number(parsed.data.campusCount) : null,
    currentSoftware: parsed.data.currentSoftware || null,
    requiredModules: parsed.data.requiredModules || null,
    message: parsed.data.message || null,
  });

  return { status: "success" };
}
