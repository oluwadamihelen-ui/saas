import type { Metadata } from "next";
import { Mic } from "lucide-react";
import { prisma } from "@/server/db/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioPreviewButton } from "@/components/dashboard/audio-preview-button";

export const metadata: Metadata = { title: "Voices" };

const STYLE_LABEL: Record<string, string> = {
  WARM: "Warm",
  ENERGETIC: "Energetic",
  DRAMATIC: "Dramatic",
  PROFESSIONAL: "Professional",
  EDUCATIONAL: "Educational",
  FRIENDLY: "Friendly",
  STORYTELLING: "Storytelling",
};

export default async function VoicesPage() {
  const voices = await prisma.voicePreset.findMany({
    where: { isSystem: true },
    orderBy: [{ style: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Voice Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse narration voices by style, language and accent. Assign one to a scene from the storyboard.
      </p>

      {voices.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center justify-center gap-3 p-16 text-center">
          <Mic className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No voices yet — run <code>npx prisma db seed</code> to populate the system voice library.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {voices.map((v) => (
            <Card key={v.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold">{v.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.gender ?? "Voice"} · {v.language.toUpperCase()}{v.accent ? ` (${v.accent})` : ""}
                  </p>
                </div>
                <Badge variant="brand">{STYLE_LABEL[v.style] ?? v.style}</Badge>
              </div>
              {v.previewUrl && (
                <div className="mt-4">
                  <AudioPreviewButton src={v.previewUrl} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
