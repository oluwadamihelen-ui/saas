import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Templates</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ready-made starting points for common video types.
      </p>
      <div className="mt-8">
        <EmptyState
          icon={LayoutTemplate}
          title="Templates are coming next"
          description="Pre-configured storyboards for explainers, lessons, stories and social clips to speed up your first draft."
          phaseLabel="Phase C — Creator experience"
        />
      </div>
    </div>
  );
}
