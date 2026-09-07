"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";
import { createApplicationVersion, getLatestVersion } from "@/lib/services/application-versions";

function splitLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitCsv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const applicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  categoryId: z.string().uuid(),
  shortDescription: z.string().trim().min(1).max(500),
  fullDescription: z.string().trim().min(1),
  currentVersion: z.string().trim().min(1).max(40),
  demoUrl: z.string().trim().url().optional().or(z.literal("")),
  demoUsername: z.string().trim().max(120).optional().or(z.literal("")),
  demoPassword: z.string().trim().max(120).optional().or(z.literal("")),
  featured: z.coerce.boolean().default(false),
  seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(300).optional().or(z.literal("")),
  licensePrice: z.coerce.number().min(0),
  installationPrice: z.coerce.number().min(0).optional(),
  customizationPrice: z.coerce.number().min(0).optional(),
  maintenancePrice: z.coerce.number().min(0).optional(),
  runtime: z.string().trim().min(1).max(80),
  databaseType: z.string().trim().max(80).optional().or(z.literal("")),
  buildCommand: z.string().trim().max(300).optional().or(z.literal("")),
  startCommand: z.string().trim().max(300).optional().or(z.literal("")),
});

function parseApplicationForm(formData: FormData) {
  return applicationSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    fullDescription: formData.get("fullDescription"),
    currentVersion: formData.get("currentVersion"),
    demoUrl: formData.get("demoUrl") || undefined,
    demoUsername: formData.get("demoUsername") || undefined,
    demoPassword: formData.get("demoPassword") || undefined,
    featured: formData.get("featured") === "on",
    seoTitle: formData.get("seoTitle") || undefined,
    seoDescription: formData.get("seoDescription") || undefined,
    licensePrice: formData.get("licensePrice"),
    installationPrice: formData.get("installationPrice") || undefined,
    customizationPrice: formData.get("customizationPrice") || undefined,
    maintenancePrice: formData.get("maintenancePrice") || undefined,
    runtime: formData.get("runtime"),
    databaseType: formData.get("databaseType") || undefined,
    buildCommand: formData.get("buildCommand") || undefined,
    startCommand: formData.get("startCommand") || undefined,
  });
}

async function syncPricing(applicationId: string, data: ReturnType<typeof parseApplicationForm>) {
  await prisma.applicationPricing.deleteMany({ where: { applicationId } });
  const rows: { type: "LICENSE" | "INSTALLATION" | "CUSTOMIZATION" | "MAINTENANCE"; name: string; amount: number; isStartingFrom?: boolean }[] = [
    { type: "LICENSE", name: "Software License", amount: data.licensePrice },
  ];
  if (data.installationPrice) rows.push({ type: "INSTALLATION", name: "Installation", amount: data.installationPrice });
  if (data.customizationPrice)
    rows.push({ type: "CUSTOMIZATION", name: "Customization", amount: data.customizationPrice, isStartingFrom: true });
  if (data.maintenancePrice) rows.push({ type: "MAINTENANCE", name: "Maintenance", amount: data.maintenancePrice });

  await prisma.applicationPricing.createMany({
    data: rows.map((r, i) => ({
      applicationId,
      type: r.type,
      name: r.name,
      amount: r.amount,
      isStartingFrom: r.isStartingFrom ?? false,
      billingCycle: r.type === "MAINTENANCE" ? "MONTHLY" : "ONE_TIME",
      sortOrder: i,
    })),
  });
}

export async function createApplication(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const data = parseApplicationForm(formData);
  const technologyStack = splitCsv(formData.get("technologyStack"));
  const whatsIncluded = splitLines(formData.get("whatsIncluded"));
  const whatsNotIncluded = splitLines(formData.get("whatsNotIncluded"));
  const requirements = splitLines(formData.get("requirements"));
  const imageUrls = splitLines(formData.get("imageUrls"));
  const featureLines = splitLines(formData.get("features"));

  const application = await prisma.application.create({
    data: {
      name: data.name,
      slug: data.slug,
      categoryId: data.categoryId,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      currentVersion: data.currentVersion,
      technologyStack,
      whatsIncluded,
      whatsNotIncluded,
      requirements,
      demoUrl: data.demoUrl || null,
      demoUsername: data.demoUsername || null,
      demoPassword: data.demoPassword || null,
      featured: data.featured,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      status: "DRAFT",
      createdById: user.id,
      images: { create: imageUrls.map((url, i) => ({ url, sortOrder: i })) },
      features: {
        create: featureLines.map((line, i) => {
          const [title, ...rest] = line.split(":");
          return { title: title.trim(), description: rest.join(":").trim() || null, sortOrder: i };
        }),
      },
    },
  });

  await createApplicationVersion({
    applicationId: application.id,
    version: data.currentVersion,
    status: "STABLE",
    isLatest: true,
    isStable: true,
    actorId: user.id,
    spec: {
      runtime: data.runtime,
      databaseType: data.databaseType || undefined,
      buildCommand: data.buildCommand || undefined,
      startCommand: data.startCommand || undefined,
      requiredServices: data.databaseType ? [data.databaseType] : [],
      environmentVariables: [],
    },
  });

  await syncPricing(application.id, data);
  await recordAuditLog({ actorId: user.id, action: "application.created", resourceType: "Application", resourceId: application.id, newValue: { name: data.name } });

  redirect(`/admin/applications/${application.id}`);
}

export async function updateApplication(applicationId: string, formData: FormData) {
  const user = await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const data = parseApplicationForm(formData);
  const technologyStack = splitCsv(formData.get("technologyStack"));
  const whatsIncluded = splitLines(formData.get("whatsIncluded"));
  const whatsNotIncluded = splitLines(formData.get("whatsNotIncluded"));
  const requirements = splitLines(formData.get("requirements"));
  const imageUrls = splitLines(formData.get("imageUrls"));
  const featureLines = splitLines(formData.get("features"));

  const before = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        name: data.name,
        slug: data.slug,
        categoryId: data.categoryId,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription,
        currentVersion: data.currentVersion,
        technologyStack,
        whatsIncluded,
        whatsNotIncluded,
        requirements,
        demoUrl: data.demoUrl || null,
        demoUsername: data.demoUsername || null,
        demoPassword: data.demoPassword || null,
        featured: data.featured,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
      },
    });

    await tx.applicationImage.deleteMany({ where: { applicationId } });
    await tx.applicationImage.createMany({ data: imageUrls.map((url, i) => ({ applicationId, url, sortOrder: i })) });

    await tx.applicationFeature.deleteMany({ where: { applicationId } });
    await tx.applicationFeature.createMany({
      data: featureLines.map((line, i) => {
        const [title, ...rest] = line.split(":");
        return { applicationId, title: title.trim(), description: rest.join(":").trim() || null, sortOrder: i };
      }),
    });

  });

  const latestVersion = await getLatestVersion(applicationId);
  if (latestVersion?.deploymentSpecificationId) {
    await prisma.applicationVersion.update({ where: { id: latestVersion.id }, data: { version: data.currentVersion } });
    await prisma.deploymentSpecification.update({
      where: { id: latestVersion.deploymentSpecificationId },
      data: {
        runtime: data.runtime,
        databaseType: data.databaseType || null,
        buildCommand: data.buildCommand || null,
        startCommand: data.startCommand || null,
      },
    });
  } else {
    await createApplicationVersion({
      applicationId,
      version: data.currentVersion,
      status: "STABLE",
      isLatest: true,
      isStable: true,
      actorId: user.id,
      spec: {
        runtime: data.runtime,
        databaseType: data.databaseType || undefined,
        buildCommand: data.buildCommand || undefined,
        startCommand: data.startCommand || undefined,
        requiredServices: data.databaseType ? [data.databaseType] : [],
        environmentVariables: [],
      },
    });
  }

  await syncPricing(applicationId, data);
  await recordAuditLog({
    actorId: user.id,
    action: "application.updated",
    resourceType: "Application",
    resourceId: applicationId,
    oldValue: { name: before.name, slug: before.slug },
    newValue: { name: data.name, slug: data.slug },
  });

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath("/admin/applications");
}

export async function setApplicationStatus(applicationId: string, status: "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED") {
  const user = await requirePermission(PERMISSIONS.APPLICATIONS_PUBLISH);
  const before = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  await prisma.application.update({ where: { id: applicationId }, data: { status } });
  await recordAuditLog({
    actorId: user.id,
    action: "application.status_changed",
    resourceType: "Application",
    resourceId: applicationId,
    oldValue: { status: before.status },
    newValue: { status },
  });
  revalidatePath("/admin/applications");
}

export async function toggleFeatured(applicationId: string, featured: boolean) {
  await requireUser();
  await prisma.application.update({ where: { id: applicationId }, data: { featured } });
  revalidatePath("/admin/applications");
}
