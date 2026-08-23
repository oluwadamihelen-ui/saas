import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { updateSceneVoiceSettingsForUser, SceneNotFoundError } from "@/server/scenes/repository";
import { sceneVoiceSettingsSchema } from "@/lib/validation/voice";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = sceneVoiceSettingsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid voice settings." }, { status: 400 });

    const scene = await updateSceneVoiceSettingsForUser(userId, id, parsed.data);
    return NextResponse.json({ scene });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
