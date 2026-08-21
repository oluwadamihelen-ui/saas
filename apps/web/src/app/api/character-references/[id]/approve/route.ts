import { NextResponse } from "next/server";
import { approveCharacterReference } from "@cinerra/domain";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    await approveCharacterReference(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
