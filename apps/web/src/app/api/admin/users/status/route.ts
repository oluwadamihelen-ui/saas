import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { suspendUser, unsuspendUser } from "@/lib/trustSafety";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  targetUserEmail: z.string().email(),
  action: z.enum(["SUSPEND", "UNSUSPEND"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin();
    const { targetUserEmail, action, reason } = bodySchema.parse(await request.json());
    if (action === "SUSPEND") {
      await suspendUser({ targetUserEmail, adminUserId, reason });
    } else {
      await unsuspendUser({ targetUserEmail, adminUserId });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
