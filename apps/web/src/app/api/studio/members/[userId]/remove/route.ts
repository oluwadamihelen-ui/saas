import { NextResponse } from "next/server";
import { removeOrganizationMember, NotOrganizationOwnerError, OwnerCannotLeaveError } from "@/lib/organizations";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST(_request: Request, { params }: { params: { userId: string } }) {
  try {
    const callerId = await requireUserId();
    await removeOrganizationMember(callerId, params.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NotOrganizationOwnerError || error instanceof OwnerCannotLeaveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
