import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getContentAccess, ContentNotFoundError, type ContentScope } from "@/lib/monetization";
import { toApiErrorResponse } from "@/lib/apiError";

const VALID_SCOPES = new Set(["MOVIE", "EPISODE", "SCENE"]);

export async function GET(_request: Request, { params }: { params: { scope: string; id: string } }) {
  try {
    if (!VALID_SCOPES.has(params.scope)) {
      return NextResponse.json({ error: "Invalid content scope." }, { status: 400 });
    }
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const access = await getContentAccess(userId, params.scope as ContentScope, params.id);
    return NextResponse.json(access);
  } catch (error) {
    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return toApiErrorResponse(error);
  }
}
