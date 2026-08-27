import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { updatePlanDoeAllowances } from "@/lib/plans";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  plans: z.array(z.object({ planId: z.string().min(1), includedGenerationDoe: z.number().int().min(0) })).min(1),
});

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const { plans } = bodySchema.parse(await request.json());
    await updatePlanDoeAllowances(plans);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
