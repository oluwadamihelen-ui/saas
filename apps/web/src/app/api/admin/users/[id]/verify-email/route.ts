import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { verifyUserEmail } from "@/lib/userAdmin";
import { toApiErrorResponse } from "@/lib/apiError";

/** Manual override for accounts stuck unverified because outbound email isn't actually working. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const adminUserId = await requireAdmin();
    await verifyUserEmail({ targetUserId: params.id, adminUserId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
