import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { getProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";
import { prisma } from "@/server/db/client";
import { EditorWorkspace } from "@/components/dashboard/editor/editor-workspace";

export const metadata: Metadata = { title: "Editor" };

export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  let project;
  try {
    project = await getProjectForUser(session!.user.id, id);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) notFound();
    throw err;
  }

  const [voices, musicTracks] = await Promise.all([
    prisma.voicePreset.findMany({ where: { isSystem: true }, orderBy: [{ style: "asc" }, { name: "asc" }] }),
    prisma.musicTrack.findMany({ where: { isSystem: true }, orderBy: { name: "asc" } }),
  ]);

  return <EditorWorkspace project={project} voices={voices} musicTracks={musicTracks} />;
}
