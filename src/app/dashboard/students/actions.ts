"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { createStudent, updateStudent, withdrawStudent, addGuardianToStudent } from "@/lib/services/students";
import { inviteGuardianToPortal, inviteStudentToPortal } from "@/lib/services/portal-invites";
import { logAudit } from "@/lib/audit";
import { StudentLimitError } from "@/lib/billing/entitlements";
import { fileToStudentPhotoDataUrl } from "@/lib/logo-upload";

/// Only returns a value when a new photo was actually chosen — leaving the
/// result undefined (rather than null) lets both create and update pass it
/// straight through to StudentInput.photoUrl without ever accidentally
/// clearing an existing photo just because the (browser-unfillable) file
/// input was left empty on an edit.
async function extractPhotoUrl(formData: FormData): Promise<{ photoUrl?: string; error?: string }> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return {};
  try {
    return { photoUrl: await fileToStudentPhotoDataUrl(file) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not process this photo." };
  }
}

const genderEnum = z.enum(["MALE", "FEMALE"]);
const relationshipEnum = z.enum(["FATHER", "MOTHER", "GUARDIAN", "OTHER"]);

const studentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  otherNames: z.string().trim().max(100).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: genderEnum.optional().or(z.literal("")),
  bloodGroup: z.string().trim().max(10).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  medicalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  allergies: z.string().trim().max(1000).optional().or(z.literal("")),
  emergencyContact: z.string().trim().max(200).optional().or(z.literal("")),
  classArmId: z.string().trim().optional().or(z.literal("")),
});

const guardianFieldsSchema = z.object({
  guardianFirstName: z.string().trim().max(100).optional().or(z.literal("")),
  guardianLastName: z.string().trim().max(100).optional().or(z.literal("")),
  guardianPhone: z.string().trim().max(40).optional().or(z.literal("")),
  guardianEmail: z.string().trim().email().optional().or(z.literal("")),
  guardianRelationship: relationshipEnum.optional().or(z.literal("")),
});

export interface StudentFormState {
  status: "idle" | "error";
  message?: string;
  limitReached?: boolean;
}

function extractStudentFields(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    otherNames: formData.get("otherNames") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    gender: formData.get("gender") ?? "",
    bloodGroup: formData.get("bloodGroup") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    medicalNotes: formData.get("medicalNotes") ?? "",
    allergies: formData.get("allergies") ?? "",
    emergencyContact: formData.get("emergencyContact") ?? "",
    classArmId: formData.get("classArmId") ?? "",
  };
}

export async function createStudentAction(_prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const user = await requirePermission(PERMISSIONS.STUDENTS_CREATE);

  const parsed = studentSchema.safeParse(extractStudentFields(formData));
  const guardianParsed = guardianFieldsSchema.safeParse({
    guardianFirstName: formData.get("guardianFirstName") ?? "",
    guardianLastName: formData.get("guardianLastName") ?? "",
    guardianPhone: formData.get("guardianPhone") ?? "",
    guardianEmail: formData.get("guardianEmail") ?? "",
    guardianRelationship: formData.get("guardianRelationship") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the student's details." };
  }
  if (!guardianParsed.success) {
    return { status: "error", message: "Please check the guardian's details." };
  }

  const { photoUrl, error: photoError } = await extractPhotoUrl(formData);
  if (photoError) {
    return { status: "error", message: photoError };
  }

  const g = guardianParsed.data;
  const hasGuardian = Boolean(g.guardianFirstName && g.guardianLastName && g.guardianPhone && g.guardianRelationship);

  let student;
  try {
    student = await createStudent(user.schoolId, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      otherNames: parsed.data.otherNames || null,
      photoUrl,
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
      gender: (parsed.data.gender as "MALE" | "FEMALE") || null,
      bloodGroup: parsed.data.bloodGroup || null,
      addressLine: parsed.data.addressLine || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      medicalNotes: parsed.data.medicalNotes || null,
      allergies: parsed.data.allergies || null,
      emergencyContact: parsed.data.emergencyContact || null,
      classArmId: parsed.data.classArmId || null,
      guardian: hasGuardian
        ? {
            firstName: g.guardianFirstName!,
            lastName: g.guardianLastName!,
            phone: g.guardianPhone!,
            email: g.guardianEmail || null,
            relationship: g.guardianRelationship as "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER",
          }
        : null,
    });
  } catch (error) {
    if (error instanceof StudentLimitError) {
      return { status: "error", message: error.message, limitReached: true };
    }
    return { status: "error", message: error instanceof Error ? error.message : "Could not enroll this student." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "student.created",
    resourceType: "Student",
    resourceId: student.id,
    newValue: { firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber },
  });

  revalidatePath("/dashboard/students");
  redirect(`/dashboard/students/${student.id}`);
}

export async function updateStudentAction(
  studentId: string,
  _prev: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const user = await requirePermission(PERMISSIONS.STUDENTS_EDIT);

  const parsed = studentSchema.safeParse(extractStudentFields(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the student's details." };
  }

  const { photoUrl, error: photoError } = await extractPhotoUrl(formData);
  if (photoError) {
    return { status: "error", message: photoError };
  }

  await updateStudent(user.schoolId, studentId, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    otherNames: parsed.data.otherNames || null,
    photoUrl,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
    gender: (parsed.data.gender as "MALE" | "FEMALE") || null,
    bloodGroup: parsed.data.bloodGroup || null,
    addressLine: parsed.data.addressLine || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    medicalNotes: parsed.data.medicalNotes || null,
    allergies: parsed.data.allergies || null,
    emergencyContact: parsed.data.emergencyContact || null,
    classArmId: parsed.data.classArmId || null,
  });

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "student.updated",
    resourceType: "Student",
    resourceId: studentId,
  });

  revalidatePath(`/dashboard/students/${studentId}`);
  redirect(`/dashboard/students/${studentId}`);
}

export async function withdrawStudentAction(studentId: string) {
  const user = await requirePermission(PERMISSIONS.STUDENTS_DELETE);
  await withdrawStudent(user.schoolId, studentId);
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "student.withdrawn",
    resourceType: "Student",
    resourceId: studentId,
  });
  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${studentId}`);
}

const addGuardianSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z.string().trim().min(1, "Phone is required").max(40),
  email: z.string().trim().email().optional().or(z.literal("")),
  relationship: relationshipEnum,
});

export interface AddGuardianState {
  status: "idle" | "error";
  message?: string;
}

export async function addGuardianAction(
  studentId: string,
  _prev: AddGuardianState,
  formData: FormData
): Promise<AddGuardianState> {
  const user = await requirePermission(PERMISSIONS.GUARDIANS_MANAGE);

  const parsed = addGuardianSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    relationship: formData.get("relationship"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the guardian's details." };
  }

  await addGuardianToStudent(user.schoolId, studentId, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    relationship: parsed.data.relationship,
  });

  revalidatePath(`/dashboard/students/${studentId}`);
  return { status: "idle" };
}

const portalInviteEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export interface PortalInviteState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function inviteGuardianPortalAction(
  studentId: string,
  guardianId: string,
  _prev: PortalInviteState,
  formData: FormData
): Promise<PortalInviteState> {
  const user = await requirePermission(PERMISSIONS.GUARDIANS_MANAGE);

  const parsed = portalInviteEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }

  try {
    await inviteGuardianToPortal(user.schoolId, user.id, guardianId, parsed.data.email);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not send invite." };
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { status: "success" };
}

export async function inviteStudentPortalAction(
  studentId: string,
  _prev: PortalInviteState,
  formData: FormData
): Promise<PortalInviteState> {
  const user = await requirePermission(PERMISSIONS.STUDENTS_EDIT);

  // A student too young to have their own email logs in with their
  // admission number instead (see the "Student login" tab on /login) — the
  // teacher/admin ticks this box instead of typing a made-up address, and
  // the email field's own validation is skipped entirely.
  const useAdmissionNumber = formData.get("useAdmissionNumber") === "on";

  let email: string | undefined;
  if (!useAdmissionNumber) {
    const parsed = portalInviteEmailSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) {
      return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email." };
    }
    email = parsed.data.email;
  }

  try {
    await inviteStudentToPortal(user.schoolId, user.id, studentId, email);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not send invite." };
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { status: "success" };
}
