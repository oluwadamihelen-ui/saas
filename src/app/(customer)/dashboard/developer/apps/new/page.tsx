import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { DeveloperApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "Submit an Application" };

export default async function NewDeveloperApplicationPage() {
  await requireRole("DEVELOPER");
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Submit an Application</h1>
      <DeveloperApplicationForm categories={categories} />
    </div>
  );
}
