import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { getCharacterForUser, updateCharacterForUser, CharacterNotFoundError } from "@/server/characters/repository";
import { getImageProvider } from "@/server/providers";
import { getStorageProvider } from "@/server/storage";
import { applyCreditDelta, InsufficientCreditsError } from "@/server/credits/ledger";
import { CREDIT_COSTS } from "@/lib/plans";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    if (!rateLimit(requestKey(req, `char-portrait:${userId}`), 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const character = await getCharacterForUser(userId, id);

    await applyCreditDelta(userId, -CREDIT_COSTS.IMAGE_GENERATION, "IMAGE_GENERATION", { characterId: id });

    const asset = await getImageProvider().generateCharacterPortrait({
      name: character.name,
      descriptor: character.visualDescriptor ?? character.name,
    });

    const { url } = await getStorageProvider().put({
      category: "references",
      filename: `character-${id}.svg`,
      data: asset.buffer,
      contentType: asset.contentType,
    });

    const updated = await updateCharacterForUser(userId, id, { referenceImageUrl: url });
    return NextResponse.json({ character: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CharacterNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (err instanceof InsufficientCreditsError) return NextResponse.json({ error: "Not enough credits." }, { status: 402 });
    throw err;
  }
}
