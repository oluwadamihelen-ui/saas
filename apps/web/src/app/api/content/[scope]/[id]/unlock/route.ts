import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { unlockContent, ContentNotFoundError, ContentNotPaidError, InsufficientCoinsError, type ContentScope } from "@/lib/monetization";
import { toApiErrorResponse } from "@/lib/apiError";

const VALID_SCOPES = new Set(["MOVIE", "EPISODE", "SCENE"]);

/**
 * The critical transactional endpoint (spec §9-10, §39). Note what's
 * absent from the request: no price, no publisherId — those are resolved
 * server-side inside unlockContent from the database, never trusted from
 * the caller.
 */
export async function POST(_request: Request, { params }: { params: { scope: string; id: string } }) {
  try {
    if (!VALID_SCOPES.has(params.scope)) {
      return NextResponse.json({ error: "Invalid content scope." }, { status: 400 });
    }
    const userId = await requireUserId();
    const result = await unlockContent(userId, params.scope as ContentScope, params.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ContentNotPaidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json({ error: error.message, required: error.required, balance: error.balance }, { status: 402 });
    }
    return toApiErrorResponse(error);
  }
}
