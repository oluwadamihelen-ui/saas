"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";
import { bundleSchema, createBundle, updateBundle, setBundleActive } from "@/lib/services/bundles";

export interface BundleFormState {
  status: "idle" | "error";
  message?: string;
}

function parseItems(formData: FormData) {
  const types = formData.getAll("itemType");
  const applicationIds = formData.getAll("itemApplicationId");
  const hostingPlanIds = formData.getAll("itemHostingPlanId");
  const serviceLabels = formData.getAll("itemServiceLabel");
  const quantities = formData.getAll("itemQuantity");

  return types.map((type, i) => ({
    type,
    applicationId: applicationIds[i],
    hostingPlanId: hostingPlanIds[i],
    serviceLabel: serviceLabels[i],
    quantity: quantities[i],
  }));
}

function parseBundleForm(formData: FormData) {
  return bundleSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    items: parseItems(formData),
  });
}

export async function createBundleAdmin(_prev: BundleFormState, formData: FormData): Promise<BundleFormState> {
  const admin = await requirePermission(PERMISSIONS.COUPONS_MANAGE);
  const parsed = parseBundleForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the bundle fields." };
  }

  const existing = await prisma.bundle.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { status: "error", message: `A bundle with slug "${parsed.data.slug}" already exists.` };
  }

  const bundle = await createBundle(parsed.data);
  await recordAuditLog({ actorId: admin.id, action: "bundle.created", resourceType: "Bundle", resourceId: bundle.id, newValue: { name: bundle.name, price: Number(bundle.price) } });

  redirect(`/admin/bundles/${bundle.id}`);
}

export async function updateBundleAdmin(bundleId: string, _prev: BundleFormState, formData: FormData): Promise<BundleFormState> {
  const admin = await requirePermission(PERMISSIONS.COUPONS_MANAGE);
  const parsed = parseBundleForm(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the bundle fields." };
  }

  await updateBundle(bundleId, parsed.data);
  await recordAuditLog({ actorId: admin.id, action: "bundle.updated", resourceType: "Bundle", resourceId: bundleId, newValue: { name: parsed.data.name, price: parsed.data.price } });

  revalidatePath(`/admin/bundles/${bundleId}`);
  revalidatePath("/admin/bundles");
  return { status: "idle" };
}

export async function setBundleActiveAdmin(bundleId: string, isActive: boolean) {
  const admin = await requirePermission(PERMISSIONS.COUPONS_MANAGE);
  await setBundleActive(bundleId, isActive);
  await recordAuditLog({ actorId: admin.id, action: isActive ? "bundle.enabled" : "bundle.disabled", resourceType: "Bundle", resourceId: bundleId });
  revalidatePath("/admin/bundles");
  revalidatePath(`/admin/bundles/${bundleId}`);
}
