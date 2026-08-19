"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneCard, type SceneData } from "./scene-card";

export function StoryboardGrid({ projectId, scenes }: { projectId: string; scenes: SceneData[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPending = scenes.some((s) => s.imageStatus === "QUEUED" || s.imageStatus === "PROCESSING");

  useEffect(() => {
    if (hasPending && !intervalRef.current) {
      intervalRef.current = setInterval(() => router.refresh(), 2500);
    }
    if (!hasPending && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasPending, router]);

  async function onAddScene() {
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene, i) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            isFirst={i === 0}
            isLast={i === scenes.length - 1}
            onChanged={() => router.refresh()}
          />
        ))}
      </div>
      <div className="mt-4">
        <Button variant="secondary" onClick={onAddScene} disabled={adding}>
          <PlusCircle className="h-4 w-4" /> {adding ? "Adding…" : "Add scene"}
        </Button>
      </div>
    </div>
  );
}
