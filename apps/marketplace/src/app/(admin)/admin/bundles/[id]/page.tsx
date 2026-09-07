import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { BundleForm } from "../bundle-form";
import { updateBundleAdmin, setBundleActiveAdmin } from "../actions";

export default async function EditBundlePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.COUPONS_MANAGE);
  const { id } = await params;

  const [bundle, applications, hostingPlans] = await Promise.all([
    prisma.bundle.findUnique({ where: { id }, include: { items: true } }),
    prisma.application.findMany({ where: { status: "PUBLISHED" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.hostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!bundle) notFound();

  const updateAction = updateBundleAdmin.bind(null, bundle.id);
  const toggleActive = setBundleActiveAdmin.bind(null, bundle.id, !bundle.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{bundle.name}</h1>
        <form action={toggleActive}>
          <Button type="submit" size="sm" variant={bundle.isActive ? "secondary" : "primary"}>
            {bundle.isActive ? "Deactivate" : "Activate"}
          </Button>
        </form>
      </div>

      <BundleForm
        action={updateAction}
        applications={applications}
        hostingPlans={hostingPlans}
        defaultValues={{
          name: bundle.name,
          slug: bundle.slug,
          description: bundle.description ?? "",
          price: Number(bundle.price),
          items: bundle.items.map((item, i) => ({
            key: i,
            type: item.type,
            applicationId: item.applicationId ?? "",
            hostingPlanId: item.hostingPlanId ?? "",
            serviceLabel: item.serviceLabel ?? "",
            quantity: String(item.quantity),
          })),
        }}
        submitLabel="Save Changes"
      />
    </div>
  );
}
