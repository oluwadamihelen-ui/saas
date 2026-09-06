import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ApplicationForm } from "../application-form";
import { updateApplication } from "../actions";

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const { id } = await params;

  const [application, categories] = await Promise.all([
    prisma.application.findUnique({
      where: { id },
      include: { images: true, features: true, pricing: true, versions: { where: { isCurrent: true }, take: 1 } },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!application) notFound();

  const pricingByType = Object.fromEntries(application.pricing.map((p) => [p.type, Number(p.amount)]));
  const version = application.versions[0];
  const boundAction = updateApplication.bind(null, application.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {application.name}</h1>
      <ApplicationForm
        action={boundAction}
        categories={categories}
        submitLabel="Save Changes"
        defaultValues={{
          name: application.name,
          slug: application.slug,
          categoryId: application.categoryId,
          shortDescription: application.shortDescription,
          fullDescription: application.fullDescription,
          currentVersion: application.currentVersion,
          technologyStack: application.technologyStack.join(", "),
          whatsIncluded: application.whatsIncluded.join("\n"),
          whatsNotIncluded: application.whatsNotIncluded.join("\n"),
          requirements: application.requirements.join("\n"),
          demoUrl: application.demoUrl ?? "",
          demoUsername: application.demoUsername ?? "",
          demoPassword: application.demoPassword ?? "",
          featured: application.featured,
          seoTitle: application.seoTitle ?? "",
          seoDescription: application.seoDescription ?? "",
          licensePrice: pricingByType.LICENSE ?? 0,
          installationPrice: pricingByType.INSTALLATION ?? 0,
          customizationPrice: pricingByType.CUSTOMIZATION ?? 0,
          maintenancePrice: pricingByType.MAINTENANCE ?? 0,
          runtime: version?.runtime ?? "",
          databaseType: version?.databaseType ?? "",
          buildCommand: version?.buildCommand ?? "",
          startCommand: version?.startCommand ?? "",
          imageUrls: application.images.map((i) => i.url).join("\n"),
          features: application.features.map((f) => (f.description ? `${f.title}: ${f.description}` : f.title)).join("\n"),
        }}
      />
    </div>
  );
}
