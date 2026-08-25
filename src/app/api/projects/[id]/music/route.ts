import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { attachMusicToProject, removeMusicFromProject, ProjectNotFoundError } from "@/server/projects/repository";
import { attachProjectMusicSchema } from "@/lib/validation/voice";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `attach-music:${userId}`), 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = attachProjectMusicSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid music selection." }, { status: 400 });

    const projectMusic = await attachMusicToProject(userId, id, parsed.data);
    return NextResponse.json({ projectMusic });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `remove-music:${userId}`), 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { id } = await params;
    await removeMusicFromProject(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
