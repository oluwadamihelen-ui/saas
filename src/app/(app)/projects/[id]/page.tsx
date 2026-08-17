import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { auth } from "@/server/auth";
import { getProjectForUser, ProjectNotFoundError } from "@/server/projects/repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VISUAL_STYLES, ASPECT_RATIOS } from "@/lib/style-options";

export const metadata: Metadata = { title: "Project" };

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

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{project.title}</h1>
          {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <Badge variant="brand">{project.status.replaceAll("_", " ")}</Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className={`bg-gradient-to-br ${style?.gradient ?? "from-brand-300 to-brand-500"} aspect-video`} />

          <Card className="mt-6 flex items-start gap-4 p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-100">
              <Sparkles className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Storyboard generation is coming next</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                This project has been created and saved. Script analysis, storyboard
                generation, character extraction and scene rendering are part of the
                AI pipeline being built next — once available, you&apos;ll be able to
                trigger it directly from this page.
              </p>
            </div>
          </Card>

          {(project.idea || project.script) && (
            <Card className="mt-6 p-6">
              <h3 className="font-display font-semibold">{project.script ? "Script" : "Idea"}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {project.script || project.idea}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-sm font-semibold">Details</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Visual style" value={style?.label ?? project.visualStyle} />
              <Row label="Aspect ratio" value={ratio?.label ?? project.aspectRatio} />
              <Row label="Language" value={project.language} />
              {project.audience && <Row label="Audience" value={project.audience} />}
              {project.targetLengthSeconds && <Row label="Target length" value={`${project.targetLengthSeconds}s`} />}
              <Row label="Scenes" value={String(project.scenes.length)} />
              <Row label="Characters" value={String(project.characters.length)} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
