import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { BundleForm } from "../bundle-form";
import { createBundleAdmin } from "../actions";

export const metadata: Metadata = { title: "New Bundle" };

export default async function NewBundlePage() {
  await requirePermission(PERMISSIONS.COUPONS_MANAGE);

  const [applications, hostingPlans] = await Promise.all([
    prisma.application.findMany({ where: { status: "PUBLISHED" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.hostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Bundle</h1>
      <BundleForm action={createBundleAdmin} applications={applications} hostingPlans={hostingPlans} submitLabel="Create Bundle" />
    </div>
  );
}
