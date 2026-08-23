import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateUserName } from "@/lib/accounts";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty.").max(100),
});

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { name } = bodySchema.parse(await request.json());
    const user = await updateUserName(userId, name);
    return NextResponse.json({ user: { id: user.id, name: user.name } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
