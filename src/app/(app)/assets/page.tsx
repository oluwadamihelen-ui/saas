import type { Metadata } from "next";
import { Image as ImageIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Assets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every image, audio clip and video generated for your projects, stored in one place.
      </p>
      <div className="mt-8">
        <EmptyState
          icon={ImageIcon}
          title="No assets yet"
          description="Generated scene images, animations, narration and music tracks will appear here once you start creating videos."
          phaseLabel="Phase B–D — AI workflow & rendering"
        />
      </div>
    </div>
  );
}
