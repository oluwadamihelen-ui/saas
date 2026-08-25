import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { getCharacterForUser, updateCharacterForUser, deleteCharacterForUser, CharacterNotFoundError } from "@/server/characters/repository";
import { updateCharacterSchema } from "@/lib/validation/character";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const character = await getCharacterForUser(userId, id);
    return NextResponse.json({ character });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CharacterNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `update-character:${userId}`), 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = updateCharacterSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid character data." }, { status: 400 });

    const character = await updateCharacterForUser(userId, id, parsed.data);
    return NextResponse.json({ character });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CharacterNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `delete-character:${userId}`), 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { id } = await params;
    await deleteCharacterForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CharacterNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
