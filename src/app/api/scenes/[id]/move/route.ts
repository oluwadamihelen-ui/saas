import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { moveSceneForUser, SceneNotFoundError } from "@/server/scenes/repository";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({ direction: z.enum(["up", "down"]) });

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid direction." }, { status: 400 });

    await moveSceneForUser(userId, id, parsed.data.direction);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof SceneNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
