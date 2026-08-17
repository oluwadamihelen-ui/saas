import type { Metadata } from "next";
import { Music2 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Music" };

export default function MusicPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Music Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mood-matched background scores that automatically duck under narration.
      </p>
      <div className="mt-8">
        <EmptyState
          icon={Music2}
          title="The music library is coming next"
          description="Cinematic, happy, emotional, inspirational, suspense, calm, adventure, corporate and children's tracks — with volume, fade and loop control."
          phaseLabel="Phase C — Creator experience"
        />
      </div>
    </div>
  );
}
