import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/server/auth";
import { getProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";
import { getLatestRenderJobForUser } from "@/server/render/repository";
import { ExportPanel } from "@/components/dashboard/export-panel";

export const metadata: Metadata = { title: "Export" };

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  let project;
  try {
    project = await getProjectForUser(session!.user.id, id);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) notFound();
    throw err;
  }

  const renderJob = await getLatestRenderJobForUser(session!.user.id, id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to project
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Export &quot;{project.title}&quot;</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Renders as MP4 in {project.aspectRatio === "RATIO_16_9" ? "16:9" : project.aspectRatio === "RATIO_9_16" ? "9:16" : "1:1"}, matching your project&apos;s aspect ratio.
      </p>

      <div className="mt-8">
        <ExportPanel projectId={id} initialJob={renderJob} />
      </div>
    </div>
  );
}
