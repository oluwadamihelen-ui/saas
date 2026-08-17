import type { Metadata } from "next";
import { Users2 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Characters" };

export default function CharactersPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Characters</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build reusable characters that stay visually consistent across every scene and project.
      </p>
      <div className="mt-8">
        <EmptyState
          icon={Users2}
          title="Character creation is coming next"
          description="You'll be able to create a character once — name, appearance, hair, clothing and personality — and reuse it across any project."
          phaseLabel="Phase B — AI workflow"
        />
      </div>
    </div>
  );
}
