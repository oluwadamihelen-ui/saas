import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { Rocket } from "lucide-react";
import { DeployApplicationForm } from "./deploy-form";

export const metadata: Metadata = { title: "Deploy Your Application" };

export default async function NewDeploymentPage() {
  const user = await requireUser();

  const [licenses, hostingAccounts] = await Promise.all([
    prisma.applicationLicense.findMany({
      where: { customerId: user.id, status: "ACTIVE" },
      include: {
        application: {
          include: { versions: { where: { status: "STABLE" }, orderBy: { createdAt: "desc" } } },
        },
      },
    }),
    prisma.hostingAccount.findMany({ where: { customerId: user.id, status: "ACTIVE" }, include: { hostingPlan: true } }),
  ]);

  const applications = licenses
    .map((l) => l.application)
    .filter((app) => app.versions.length > 0)
    .filter((app, i, arr) => arr.findIndex((a) => a.id === app.id) === i);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deploy Your Application</h1>
        <p className="mt-1 text-sm text-muted">
          Choose a licensed application and where it should run. We&apos;ll queue the deployment and keep you updated
          with a live status timeline.
        </p>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={<Rocket className="h-8 w-8" />}
          title="No deployable applications"
          description="Purchase an application from the marketplace to unlock deployment."
        />
      ) : (
        <DeployApplicationForm
          applications={applications.map((app) => ({
            id: app.id,
            name: app.name,
            versions: app.versions.map((v) => ({ id: v.id, version: v.version, isLatest: v.isLatest })),
          }))}
          hostingAccounts={hostingAccounts.map((h) => ({ id: h.id, name: h.hostingPlan.name, domain: h.primaryDomain }))}
        />
      )}
    </div>
  );
}
