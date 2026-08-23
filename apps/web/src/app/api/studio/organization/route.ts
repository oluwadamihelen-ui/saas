import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrganization, AlreadyInOrganizationError, NotStudioPlanError } from "@/lib/organizations";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Give your studio a name.").max(80),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { name } = bodySchema.parse(await request.json());
    const organization = await createOrganization(userId, name);
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof AlreadyInOrganizationError || error instanceof NotStudioPlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
