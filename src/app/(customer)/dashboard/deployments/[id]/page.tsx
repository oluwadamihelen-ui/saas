import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { getDeploymentForCustomer } from "@/lib/services/deployments";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeploymentTimeline } from "@/components/dashboard/deployment-timeline";
import { formatDate } from "@/lib/utils";

export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deployment = await getDeploymentForCustomer(id, user.id);
  if (!deployment) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deployment.application.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {deployment.type.replaceAll("_", " ")} · v{deployment.applicationVersion.version} · started {formatDate(deployment.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={deployment.status} />
          <StatusBadge status={deployment.healthStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground">Deployment Progress</p>
            <DeploymentTimeline status={deployment.status} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground">Activity Log</p>
            {deployment.logs.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {deployment.logs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <span className="w-32 shrink-0 text-xs text-muted">{formatDate(log.createdAt)}</span>
                    <span className="text-foreground">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {deployment.domain ? (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Domain</p>
              <p className="text-sm text-muted">{deployment.domain.name}</p>
            </div>
            <a href={`https://${deployment.domain.name}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent">
              Visit site
            </a>
          </CardContent>
        </Card>
      ) : deployment.previewUrl && deployment.status === "COMPLETED" ? (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Application URL</p>
              <p className="text-sm text-muted">No custom domain connected yet — using a preview URL.</p>
            </div>
            <a href={deployment.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent">
              Visit site
            </a>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
