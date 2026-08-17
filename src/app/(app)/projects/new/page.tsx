import type { Metadata } from "next";
import { CreateProjectForm } from "@/components/dashboard/create-project-form";

export const metadata: Metadata = { title: "Create Video" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold">Create a new video</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Step 1 of the creation pipeline — tell Storyloom what you want to make.
      </p>
      <div className="mt-8">
        <CreateProjectForm />
      </div>
    </div>
  );
}
