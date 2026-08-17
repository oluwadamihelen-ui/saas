import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/server/auth/session";
import { getProjectForUser, deleteProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const project = await getProjectForUser(userId, id);
    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteProjectForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof ProjectNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
