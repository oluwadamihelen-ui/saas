import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { contactSchema } from "@/lib/validation/contact";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(requestKey(req, "contact"), 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  await prisma.contactMessage.create({ data: parsed.data });

  return NextResponse.json({ ok: true });
}
