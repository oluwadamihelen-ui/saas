import { NextResponse } from "next/server";
import { toggleFavorite } from "@cinerra/domain";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

/** Toggles the current user's favorite/save on a published movie. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const result = await toggleFavorite({ userId, publicationId: params.id });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
