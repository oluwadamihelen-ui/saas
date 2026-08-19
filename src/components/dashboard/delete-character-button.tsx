"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteCharacterButton({ characterId }: { characterId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/characters/${characterId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/characters");
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Delete this character?</span>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={onDelete} disabled={pending}>
          {pending ? "Deleting…" : "Confirm delete"}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setConfirming(true)}>
      <Trash2 className="h-4 w-4" /> Delete
    </Button>
  );
}
