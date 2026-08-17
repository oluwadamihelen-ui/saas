import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/server/auth";
import { listProjectsForUser } from "@/server/projects/repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteProjectButton } from "@/components/dashboard/project-card-actions";
import { PlusCircle, FolderKanban } from "lucide-react";

export const metadata: Metadata = { title: "My Projects" };

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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SCRIPT_READY: "Script ready",
  STORYBOARD_READY: "Storyboard ready",
  GENERATING: "Generating",
  READY_TO_EDIT: "Ready to edit",
  RENDERING: "Rendering",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export default async function ProjectsPage() {
  const session = await auth();
  const projects = await listProjectsForUser(session!.user.id);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">My Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"}</p>
        </div>
        <Button href="/projects/new">
          <PlusCircle className="h-4 w-4" /> Create new project
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center justify-center gap-3 p-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <FolderKanban className="h-6 w-6 text-brand-600" />
          </div>
          <p className="font-display font-semibold">No projects yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Every project starts with an idea or a script. Create your first one to see it here.
          </p>
          <Button href="/projects/new" size="sm" className="mt-2">
            <PlusCircle className="h-4 w-4" /> Create your first video
          </Button>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="group relative overflow-hidden p-0">
              <Link href={`/projects/${project.id}`}>
                <div className="aspect-video bg-gradient-to-br from-brand-200 to-ember-200" />
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/projects/${project.id}`} className="min-w-0">
                    <h3 className="line-clamp-1 font-display text-sm font-semibold hover:text-brand-600">{project.title}</h3>
                  </Link>
                  <DeleteProjectButton projectId={project.id} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[project.status]}>{STATUS_LABEL[project.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{project.scenes.length} scenes</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
