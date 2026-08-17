import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { listProjectsForUser, createProjectForUser } from "@/server/projects/repository";
import { createProjectSchema } from "@/lib/validation/project";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function GET() {
  try {
    const userId = await requireUserId();
    const projects = await listProjectsForUser(userId);
    return NextResponse.json({ projects });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();

    if (!rateLimit(requestKey(req, `create-project:${userId}`), 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid project data.", details: parsed.error.flatten() }, { status: 400 });
    }

    const project = await createProjectForUser(userId, parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
