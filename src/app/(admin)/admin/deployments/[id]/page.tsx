import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeploymentTimeline } from "@/components/dashboard/deployment-timeline";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { retryDeployment, cancelDeployment, rollbackDeployment } from "../actions";

export default async function AdminDeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.DEPLOYMENTS_VIEW);
  const { id } = await params;

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      application: true,
      applicationVersion: { include: { deploymentSpecification: true, artifact: true } },
      customer: true,
      domain: true,
      deploymentTarget: true,
      logs: { orderBy: { createdAt: "asc" } },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!deployment) notFound();

  const retry = retryDeployment.bind(null, deployment.id);
  const cancel = cancelDeployment.bind(null, deployment.id);
  const rollback = rollbackDeployment.bind(null, deployment.id);
  const canRollback = Boolean(deployment.applicationVersion.rollbackOf);
  const isTerminal = ["COMPLETED", "FAILED", "CANCELLED", "ROLLED_BACK", "UPGRADED"].includes(deployment.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deployment.application.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {deployment.customer.name} · {deployment.deploymentTarget?.provider ?? "mock"} adapter · v{deployment.applicationVersion.version}
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
          {canRollback && (
            <form action={rollback}>
              <Button size="sm" variant="secondary" type="submit">
                Rollback to {deployment.applicationVersion.rollbackOf}
              </Button>
            </form>
          )}
          {!isTerminal && (
            <form action={cancel}>
              <Button size="sm" variant="destructive" type="submit">
                Cancel
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

          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-semibold text-foreground">Deployment Target</p>
              {deployment.deploymentTarget ? (
                <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted">
                  <dt>Type</dt>
                  <dd className="text-foreground">{deployment.deploymentTarget.type}</dd>
                  <dt>Adapter</dt>
                  <dd className="text-foreground">{deployment.deploymentTarget.provider}</dd>
                  {deployment.deploymentTarget.hostname && (
                    <>
                      <dt>Hostname</dt>
                      <dd className="text-foreground">
                        {deployment.deploymentTarget.hostname}
                        {deployment.deploymentTarget.port ? `:${deployment.deploymentTarget.port}` : ""}
                      </dd>
                    </>
                  )}
                  {deployment.deploymentTarget.controlPanel && (
                    <>
                      <dt>Control panel</dt>
                      <dd className="text-foreground">{deployment.deploymentTarget.controlPanel}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="text-xs text-muted">No target recorded.</p>
              )}
              <p className="mt-2 text-xs text-muted">Credentials are stored separately, encrypted, and never shown here.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-semibold text-foreground">Deployment Specification</p>
              {deployment.applicationVersion.deploymentSpecification ? (
                <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted">
                  <dt>Runtime</dt>
                  <dd className="text-foreground">{deployment.applicationVersion.deploymentSpecification.runtime}</dd>
                  {deployment.applicationVersion.deploymentSpecification.databaseType && (
                    <>
                      <dt>Database</dt>
                      <dd className="text-foreground">{deployment.applicationVersion.deploymentSpecification.databaseType}</dd>
                    </>
                  )}
                  {deployment.applicationVersion.deploymentSpecification.buildCommand && (
                    <>
                      <dt>Build</dt>
                      <dd className="text-foreground">{deployment.applicationVersion.deploymentSpecification.buildCommand}</dd>
                    </>
                  )}
                  {deployment.applicationVersion.deploymentSpecification.startCommand && (
                    <>
                      <dt>Start</dt>
                      <dd className="text-foreground">{deployment.applicationVersion.deploymentSpecification.startCommand}</dd>
                    </>
                  )}
                  <dt>Health check</dt>
                  <dd className="text-foreground">{deployment.applicationVersion.deploymentSpecification.healthCheckPath}</dd>
                </dl>
              ) : (
                <p className="text-xs text-muted">No specification recorded.</p>
              )}
              {deployment.applicationVersion.artifact && (
                <p className="mt-2 text-xs text-muted">
                  Artifact: {deployment.applicationVersion.artifact.type} — {deployment.applicationVersion.artifact.reference}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
