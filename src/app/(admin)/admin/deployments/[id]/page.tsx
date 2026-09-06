import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeploymentTimeline } from "@/components/dashboard/deployment-timeline";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { retryDeployment } from "../actions";

export default async function AdminDeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.DEPLOYMENTS_VIEW);
  const { id } = await params;

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      application: true,
      applicationVersion: true,
      customer: true,
      domain: true,
      logs: { orderBy: { createdAt: "asc" } },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!deployment) notFound();

  const retry = retryDeployment.bind(null, deployment.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deployment.application.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {deployment.customer.name} · {deployment.adapter} adapter · v{deployment.applicationVersion.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={deployment.status} />
          {deployment.status === "FAILED" && (
            <form action={retry}>
              <Button size="sm" type="submit">
                Retry
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground">Progress</p>
            <DeploymentTimeline status={deployment.status} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent>
              <p className="mb-4 text-sm font-semibold text-foreground">Technical Logs</p>
              <div className="space-y-2 font-mono text-xs">
                {deployment.logs.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <span className="w-40 shrink-0 text-muted">{formatDate(log.createdAt)}</span>
                    <span className={log.level === "ERROR" ? "text-danger" : "text-foreground"}>[{log.level}] {log.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-4 text-sm font-semibold text-foreground">Jobs</p>
              <div className="space-y-2 text-sm">
                {deployment.jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <span>{job.jobType} (attempt {job.attempts})</span>
                    <StatusBadge status={job.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {deployment.serverConfig ? (
            <Card>
              <CardContent>
                <p className="mb-2 text-sm font-semibold text-foreground">Server Configuration</p>
                <pre className="overflow-x-auto rounded-md bg-muted-surface p-3 text-xs text-muted">
                  {JSON.stringify(deployment.serverConfig, null, 2)}
                </pre>
                <p className="mt-2 text-xs text-muted">Credentials are stored separately, encrypted, and never shown here.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
