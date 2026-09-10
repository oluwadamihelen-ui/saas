"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteEventAction } from "./actions";

export function EventRowActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center justify-end gap-2">
      <Button asChild size="sm" variant="secondary">
        <Link href={`/dashboard/administration/calendar/${id}/edit`}>Edit</Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteEventAction(id);
            router.refresh();
          })
        }
      >
        Remove
      </Button>
    </div>
  );
}
