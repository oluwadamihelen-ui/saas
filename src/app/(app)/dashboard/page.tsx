import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/server/auth";
import { getCreditBalance } from "@/server/credits/ledger";
import { listProjectsForUser } from "@/server/projects/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FolderKanban, Zap, Film, HardDrive, LayoutTemplate } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

const TEMPLATES = [
  { title: "Product explainer", style: "Modern Cartoon" },
  { title: "Kids story", style: "Storybook" },
  { title: "Lesson video", style: "Educational" },
];

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

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [creditBalance, projects] = await Promise.all([
    getCreditBalance(userId),
    listProjectsForUser(userId),
  ]);

  const recentProjects = projects.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Welcome back{session?.user.name ? `, ${session.user.name}` : ""}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your videos.</p>
        </div>
        <Button href="/projects/new">
          <PlusCircle className="h-4 w-4" /> Create new project
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Videos created" value={String(projects.length)} />
        <StatCard icon={Zap} label="Available credits" value={String(creditBalance)} accent="ember" />
        <StatCard icon={Film} label="Completed videos" value={String(projects.filter((p) => p.status === "COMPLETED").length)} />
        <StatCard icon={HardDrive} label="Storage used" value="0 MB" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent projects</h2>
            <Link href="/projects" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <Card className="mt-4 flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <FolderKanban className="h-6 w-6 text-brand-600" />
              </div>
              <p className="font-display font-semibold">No projects yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Start with an idea or a script and Storyloom will help you build your first animated video.
              </p>
              <Button href="/projects/new" size="sm" className="mt-2">
                <PlusCircle className="h-4 w-4" /> Create your first video
              </Button>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {recentProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="h-full p-4 transition-colors hover:border-brand-300">
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-brand-200 to-ember-200" />
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 font-display text-sm font-semibold">{project.title}</h3>
                      <Badge variant="brand">{STATUS_LABEL[project.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{project.scenes.length} scenes</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Quick-start templates</h2>
          <div className="mt-4 space-y-3">
            {TEMPLATES.map((t) => (
              <Card key={t.title} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100">
                  <LayoutTemplate className="h-5 w-5 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.style}</p>
                </div>
              </Card>
            ))}
          </div>

          <h2 className="mt-8 font-display text-lg font-semibold">Recent activity</h2>
          <Card className="mt-4 p-6 text-center text-sm text-muted-foreground">
            Activity will appear here once you start generating videos.
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "ember";
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${accent === "ember" ? "text-ember-500" : "text-brand-500"}`} />
      </CardHeader>
      <CardContent className="pt-2">
        <p className="font-display text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
