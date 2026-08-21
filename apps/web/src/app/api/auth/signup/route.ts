import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createUserAccount, EmailAlreadyRegisteredError } from "@/lib/accounts";
import { toApiErrorResponse } from "@/lib/apiError";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const user = await createUserAccount(body);
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return toApiErrorResponse(error);
  }
}
