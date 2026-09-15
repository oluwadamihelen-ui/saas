import { z } from "zod";

/// Kept in its own module (no "use server", no server-only imports) so it
/// can be unit-tested without pulling in requirePermission's auth/session
/// machinery — thresholds-actions.ts imports this same schema.
export const thresholdsSchema = z
  .object({
    expenseApprovalThreshold: z.coerce.number().min(0, "Must be zero or more"),
    performancePassMark: z.coerce.number().int().min(0).max(100),
    performanceSignificantChangePoints: z.coerce.number().int().min(1).max(100),
    attendanceConcernThreshold: z.coerce.number().int().min(0).max(100),
    performanceFailedSubjectConcernThreshold: z.coerce.number().int().min(1).max(50),
    healthScoreWeightAcademic: z.coerce.number().int().min(0).max(100),
    healthScoreWeightAttendance: z.coerce.number().int().min(0).max(100),
    healthScoreWeightFinancial: z.coerce.number().int().min(0).max(100),
    healthScoreWeightOperational: z.coerce.number().int().min(0).max(100),
  })
  .refine(
    (data) =>
      data.healthScoreWeightAcademic +
        data.healthScoreWeightAttendance +
        data.healthScoreWeightFinancial +
        data.healthScoreWeightOperational ===
      100,
    { message: "The four health score weights must add up to 100.", path: ["healthScoreWeightAcademic"] }
  );
