import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { getSceneForUser, SceneNotFoundError } from "@/server/scenes/repository";
import { getSceneVoiceQueue } from "@/server/jobs/queue";
import { prisma } from "@/server/db/client";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    if (!rateLimit(requestKey(req, `generate-voice:${userId}`), 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const scene = await getSceneForUser(userId, id);
    if (!scene.narration?.trim()) {
      return NextResponse.json({ error: "Add narration text to this scene first." }, { status: 400 });
    }

    await prisma.scene.update({ where: { id }, data: { voiceStatus: "QUEUED" } });
    await getSceneVoiceQueue().add(
      "generate-scene-voice",
      { sceneId: id, projectId: scene.projectId },
      { removeOnComplete: 100, removeOnFail: 100 }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
