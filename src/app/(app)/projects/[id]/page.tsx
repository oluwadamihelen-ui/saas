import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { auth } from "@/server/auth";
import { getProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VISUAL_STYLES, ASPECT_RATIOS } from "@/lib/style-options";
import { GenerationTrigger } from "@/components/dashboard/generation-trigger";
import { StoryboardGrid } from "@/components/dashboard/storyboard-grid";

export const metadata: Metadata = { title: "Project" };

const STATUS_VARIANT: Record<string, "brand" | "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SCRIPT_READY: "brand",
  STORYBOARD_READY: "brand",
  GENERATING: "warning",
  READY_TO_EDIT: "brand",
  RENDERING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  let project;
  try {
    project = await getProjectForUser(session!.user.id, id);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) notFound();
    throw err;
  }

  const style = VISUAL_STYLES.find((s) => s.value === project.visualStyle);
  const ratio = ASPECT_RATIOS.find((r) => r.value === project.aspectRatio);
  const hasContent = Boolean(project.idea || project.script);
  const isGenerating = project.status === "GENERATING" && project.scenes.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{project.title}</h1>
          {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[project.status]}>{project.status.replaceAll("_", " ")}</Badge>
          {project.scenes.length > 0 && (
            <Button href={`/projects/${project.id}/edit`} size="sm">
              <Clapperboard className="h-4 w-4" /> Open Editor
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Style" value={style?.label ?? project.visualStyle} />
        <MiniStat label="Aspect" value={ratio?.label ?? project.aspectRatio} />
        <MiniStat label="Language" value={project.language} />
        <MiniStat label="Scenes" value={String(project.scenes.length)} />
        <MiniStat label="Characters" value={String(project.characters.length)} />
        {project.targetLengthSeconds && <MiniStat label="Target length" value={`${project.targetLengthSeconds}s`} />}
      </div>

      {(project.idea || project.script) && (
        <details className="mt-6 rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer font-display text-sm font-semibold">
            {project.script ? "Script" : "Idea"}
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{project.script || project.idea}</p>
        </details>
      )}

      <div className="mt-8">
        {project.scenes.length === 0 || isGenerating ? (
          <GenerationTrigger projectId={project.id} hasContent={hasContent} />
        ) : (
          <StoryboardGrid projectId={project.id} scenes={project.scenes} />
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </Card>
  );
}
