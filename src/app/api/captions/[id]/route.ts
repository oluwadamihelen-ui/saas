import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { updateCaptionForUser, deleteCaptionForUser, CaptionNotFoundError } from "@/server/captions/repository";
import { captionSchema } from "@/lib/validation/voice";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = captionSchema.partial().safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid caption data." }, { status: 400 });

    const caption = await updateCaptionForUser(userId, id, parsed.data);
    return NextResponse.json({ caption });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CaptionNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteCaptionForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CaptionNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
