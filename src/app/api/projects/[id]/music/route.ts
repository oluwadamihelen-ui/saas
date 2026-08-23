import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { attachMusicToProject, removeMusicFromProject, ProjectNotFoundError } from "@/server/projects/repository";
import { attachProjectMusicSchema } from "@/lib/validation/voice";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
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

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await removeMusicFromProject(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
