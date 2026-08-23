import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { createRenderJobForUser, getLatestRenderJobForUser, ProjectNotFoundError } from "@/server/render/repository";
import { getProjectRenderQueue } from "@/server/jobs/queue";
import { startRenderSchema } from "@/lib/validation/render";
import { rateLimit, requestKey } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const renderJob = await getLatestRenderJobForUser(userId, id);
    return NextResponse.json({ renderJob });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    if (!rateLimit(requestKey(req, `render:${userId}`), 5, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = startRenderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid render options." }, { status: 400 });

    const existing = await getLatestRenderJobForUser(userId, id);
    if (existing && (existing.status === "QUEUED" || existing.status === "PROCESSING")) {
      return NextResponse.json({ error: "A render is already in progress for this project." }, { status: 409 });
    }

    const renderJob = await createRenderJobForUser(userId, id, parsed.data.resolution);
    await getProjectRenderQueue().add(
      "render-project",
      { renderJobId: renderJob.id },
      { removeOnComplete: 50, removeOnFail: 50 }
    );

    return NextResponse.json({ renderJob }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
