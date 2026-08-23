import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createUserAccount, EmailAlreadyRegisteredError, TermsNotAcceptedError } from "@/lib/accounts";
import { toApiErrorResponse } from "@/lib/apiError";
import { checkSignupRateLimit, getClientIp } from "@/lib/rateLimit";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }) }),
});

export async function POST(request: NextRequest) {
  try {
    const { allowed, retryAfterSeconds } = await checkSignupRateLimit(getClientIp(request.headers));
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

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
    if (error instanceof TermsNotAcceptedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
