import type { Metadata } from "next";
import { Mic } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Voices" };

export default function VoicesPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Voice Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse narration voices by language, accent and speaking style.
      </p>
      <div className="mt-8">
        <EmptyState
          icon={Mic}
          title="The voice studio is coming next"
          description="Preview voices, set speed and pitch, and assign narration per scene — warm, energetic, dramatic, professional, educational, friendly and storytelling styles."
          phaseLabel="Phase C — Creator experience"
        />
      </div>
    </div>
  );
}
