import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getRecentNotifications } from "@/lib/notifications";
import { toApiErrorResponse } from "@/lib/apiError";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { notifications, unreadCount } = await getRecentNotifications(userId);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
