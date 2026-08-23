import type { Metadata } from "next";
import { Music2 } from "lucide-react";
import { prisma } from "@/server/db/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioPreviewButton } from "@/components/dashboard/audio-preview-button";

export const metadata: Metadata = { title: "Music" };

const MOOD_LABEL: Record<string, string> = {
  CINEMATIC: "Cinematic",
  HAPPY: "Happy",
  EMOTIONAL: "Emotional",
  INSPIRATIONAL: "Inspirational",
  SUSPENSE: "Suspense",
  CALM: "Calm",
  ADVENTURE: "Adventure",
  CORPORATE: "Corporate",
  CHILDRENS: "Children's",
};

export default async function MusicPage() {
  const tracks = await prisma.musicTrack.findMany({
    where: { isSystem: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-2xl font-bold">Music Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mood-matched background scores. Attach one to a project — it automatically ducks under narration.
      </p>

      {tracks.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center justify-center gap-3 p-16 text-center">
          <Music2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No tracks yet — run <code>npx prisma db seed</code> to populate the system music library.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold">{t.name}</h3>
                  {t.durationSeconds && <p className="mt-0.5 text-xs text-muted-foreground">{t.durationSeconds}s loop</p>}
                </div>
                <Badge variant="ember">{MOOD_LABEL[t.mood] ?? t.mood}</Badge>
              </div>
              {t.url && (
                <div className="mt-4">
                  <AudioPreviewButton src={t.url} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
