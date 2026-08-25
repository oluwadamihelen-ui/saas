import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { listCaptionsForUser, addCaptionForUser, SceneNotFoundError } from "@/server/captions/repository";
import { captionSchema } from "@/lib/validation/voice";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const captions = await listCaptionsForUser(userId, id);
    return NextResponse.json({ captions });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `add-caption:${userId}`), 60, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = captionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid caption." }, { status: 400 });

    const caption = await addCaptionForUser(userId, id, parsed.data);
    return NextResponse.json({ caption }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
