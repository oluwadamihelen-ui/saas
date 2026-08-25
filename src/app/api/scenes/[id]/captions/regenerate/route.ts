import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { getSceneForUser, SceneNotFoundError } from "@/server/scenes/repository";
import { runGenerateCaptions } from "@/server/pipeline/generate-captions";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `regenerate-captions:${userId}`), 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { id } = await params;

    const scene = await getSceneForUser(userId, id);
    const captions = await runGenerateCaptions(id, scene.voiceDurationSeconds ?? scene.durationSeconds);

    return NextResponse.json({ captions });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
