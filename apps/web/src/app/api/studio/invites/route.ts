import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { inviteToOrganization, NotOrganizationOwnerError, SeatLimitReachedError, AlreadyMemberOrInvitedError } from "@/lib/organizations";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { email } = bodySchema.parse(await request.json());
    await inviteToOrganization(userId, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof NotOrganizationOwnerError || error instanceof SeatLimitReachedError || error instanceof AlreadyMemberOrInvitedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
