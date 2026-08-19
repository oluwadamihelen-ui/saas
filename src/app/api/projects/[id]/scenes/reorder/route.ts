import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { reorderScenesForUser, SceneNotFoundError } from "@/server/scenes/repository";
import { reorderScenesSchema } from "@/lib/validation/scene";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = reorderScenesSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid reorder data." }, { status: 400 });

    await reorderScenesForUser(userId, id, parsed.data.sceneIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
