import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { createUserWithPassword } from "@/server/auth/users";
import { signupSchema } from "@/lib/validation/auth";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(requestKey(req, "signup"), 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your name, email and password." }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  await createUserWithPassword({ name, email, password });

  return NextResponse.json({ ok: true });
}
