import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { updateAccountSchema } from "@/lib/validation/account";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `update-account:${userId}`), 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name },
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw err;
  }
}
