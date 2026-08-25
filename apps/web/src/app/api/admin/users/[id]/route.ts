import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { updateUserProfile } from "@/lib/userAdmin";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminUserId = await requireAdmin();
    const body = bodySchema.parse(await request.json());
    await updateUserProfile({ targetUserId: params.id, adminUserId, ...body });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
