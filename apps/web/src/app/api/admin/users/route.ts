import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/userAdmin";
import { toApiErrorResponse } from "@/lib/apiError";

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { search, page } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listUsers({ search, page });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return toApiErrorResponse(error);
  }
}
