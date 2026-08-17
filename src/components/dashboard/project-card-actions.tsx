"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function onDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-danger hover:bg-danger/10" onClick={onDelete} disabled={pending}>
          {pending ? "Deleting…" : "Confirm delete"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-muted-foreground hover:text-danger"
      onClick={(e) => {
        e.preventDefault();
        setConfirming(true);
      }}
      aria-label="Delete project"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
