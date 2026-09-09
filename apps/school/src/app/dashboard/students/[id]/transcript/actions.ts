"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { generateTranscript, revokeTranscript } from "@/lib/services/transcripts";

export async function generateTranscriptAction(studentId: string): Promise<{ error: string | null }> {
  const user = await requirePermission(PERMISSIONS.TRANSCRIPTS_VIEW);
  try {
    await generateTranscript(user.schoolId, studentId, user.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Transcript generation failed." };
  }
  revalidatePath(`/dashboard/students/${studentId}/transcript`);
  revalidatePath(`/dashboard/results/transcripts`);
  return { error: null };
}

export async function revokeTranscriptAction(
  transcriptId: string,
  studentId: string,
  reason: string
): Promise<{ error: string | null }> {
  const user = await requirePermission(PERMISSIONS.TRANSCRIPTS_MANAGE);
  try {
    await revokeTranscript(user.schoolId, transcriptId, user.id, reason);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not revoke transcript." };
  }
  revalidatePath(`/dashboard/students/${studentId}/transcript`);
  revalidatePath(`/dashboard/results/transcripts`);
  return { error: null };
}
