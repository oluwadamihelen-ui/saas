import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { listCharactersForUser, createCharacterForUser } from "@/server/characters/repository";
import { characterSchema } from "@/lib/validation/character";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function GET() {
  try {
    const userId = await requireUserId();
    const characters = await listCharactersForUser(userId);
    return NextResponse.json({ characters });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `create-character:${userId}`), 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = characterSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid character data." }, { status: 400 });

    const character = await createCharacterForUser(userId, parsed.data);
    return NextResponse.json({ character }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
