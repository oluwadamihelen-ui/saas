import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createVersion } from "../actions";

export default async function NewVersionPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const applications = await prisma.application.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Application Version</h1>
        <p className="mt-1 text-sm text-muted">
          Creates a new ApplicationVersion with its own DeploymentSpecification (and, optionally, an
          ApplicationArtifact). Existing customer deployments on other versions are never affected.
        </p>
      </div>

      <form action={createVersion} className="space-y-8">
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Release</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="applicationId">Application</Label>
              <Select id="applicationId" name="applicationId" required>
                <option value="">Select application</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name} (current: v{app.currentVersion})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="version">Version</Label>
              <Input id="version" name="version" placeholder="1.1.0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="releaseName">Release name</Label>
              <Input id="releaseName" name="releaseName" placeholder="Spring Release" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rollbackOf">Rollback target version (optional)</Label>
              <Input id="rollbackOf" name="rollbackOf" placeholder="1.0.0" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Release notes</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="publishNow" /> Publish immediately (marks as latest &amp; stable)
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Deployment Specification</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="runtime">Runtime</Label>
              <Input id="runtime" name="runtime" placeholder="node22" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="runtimeVersion">Runtime version</Label>
              <Input id="runtimeVersion" name="runtimeVersion" placeholder="22.x" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="framework">Framework</Label>
              <Input id="framework" name="framework" placeholder="Next.js" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packageManager">Package manager</Label>
              <Input id="packageManager" name="packageManager" placeholder="npm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="installCommand">Install command</Label>
              <Input id="installCommand" name="installCommand" placeholder="npm install" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buildCommand">Build command</Label>
              <Input id="buildCommand" name="buildCommand" placeholder="npm run build" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startCommand">Start command</Label>
              <Input id="startCommand" name="startCommand" placeholder="npm start" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <Input id="port" name="port" type="number" defaultValue={3000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="healthCheckPath">Health check path</Label>
              <Input id="healthCheckPath" name="healthCheckPath" defaultValue="/api/health" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="databaseType">Database</Label>
              <Input id="databaseType" name="databaseType" placeholder="postgresql" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="requiredServices">Required services (comma-separated)</Label>
              <Input id="requiredServices" name="requiredServices" placeholder="postgresql, redis" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="migrationCommand">Migration command</Label>
              <Input id="migrationCommand" name="migrationCommand" placeholder="npx prisma migrate deploy" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seedCommand">Seed command</Label>
              <Input id="seedCommand" name="seedCommand" placeholder="npm run db:seed" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="environmentVariables">
                Environment variables — one per line: <code>KEY|description|required|secret|defaultValue</code>
              </Label>
              <Textarea
                id="environmentVariables"
                name="environmentVariables"
                rows={4}
                placeholder={"DATABASE_URL|PostgreSQL connection string|true|true|\nNEXT_PUBLIC_APP_URL|Public app URL|true|false|https://example.com"}
              />
              <p className="text-xs text-muted">Secret variables are never shown to customers or logged in plaintext.</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Artifact (optional)</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="artifactType">Type</Label>
              <Select id="artifactType" name="artifactType" defaultValue="">
                <option value="">None</option>
                <option value="DOCKER_IMAGE">Docker image</option>
                <option value="GIT_REPOSITORY">Git repository</option>
                <option value="GIT_COMMIT">Git commit</option>
                <option value="ARCHIVE">Archive</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="artifactReference">Reference</Label>
              <Input id="artifactReference" name="artifactReference" placeholder="ghcr.io/forgecart/crm:1.1.0" />
            </div>
          </div>
        </section>

        <Button type="submit" size="lg">
          Create Version
        </Button>
      </form>
    </div>
  );
}
