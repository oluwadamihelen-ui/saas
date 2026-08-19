import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { getProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";
import { getProjectGenerateQueue } from "@/server/jobs/queue";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    if (!rateLimit(requestKey(req, `generate:${userId}`), 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const project = await getProjectForUser(userId, id);

    if (!project.idea && !project.script) {
      return NextResponse.json({ error: "Add an idea or script before generating." }, { status: 400 });
    }

    if (project.status === "GENERATING") {
      return NextResponse.json({ error: "This project is already generating." }, { status: 409 });
    }

    await getProjectGenerateQueue().add(
      "generate-project",
      { projectId: id },
      { removeOnComplete: 100, removeOnFail: 100 }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
