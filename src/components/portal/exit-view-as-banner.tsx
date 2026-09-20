"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { exitViewAsAction } from "@/app/actions/view-as";

export function ExitViewAsBanner({ studentName }: { studentName: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Viewing <strong>{studentName}</strong>&rsquo;s portal — read-only, they aren&rsquo;t signed out.
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(async () => {
            await exitViewAsAction();
            router.refresh();
          })
        }
      >
        {isPending ? "Exiting..." : "Exit view"}
      </Button>
    </div>
  );
}
