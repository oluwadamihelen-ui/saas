import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ApplicationForm } from "../application-form";
import { createApplication } from "../actions";

export default async function NewApplicationPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add Application</h1>
      <ApplicationForm action={createApplication} categories={categories} submitLabel="Create Application" />
    </div>
  );
}
