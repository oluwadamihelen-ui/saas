import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { markAllNotificationsRead } from "@/lib/notifications";
import { toApiErrorResponse } from "@/lib/apiError";

export async function POST() {
  try {
    const userId = await requireUserId();
    await markAllNotificationsRead(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
