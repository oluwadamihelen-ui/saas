import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { changeUserPassword, IncorrectPasswordError, NoPasswordSetError } from "@/lib/accounts";
import { requireUserId } from "@/lib/session";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { currentPassword, newPassword } = bodySchema.parse(await request.json());
    await changeUserPassword({ userId, currentPassword, newPassword });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof IncorrectPasswordError || error instanceof NoPasswordSetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
