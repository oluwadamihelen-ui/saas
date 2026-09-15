"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { deleteFeeCategoryAction, deleteFeeStructureAction } from "./actions";

export function DeleteCategoryButton({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(async () => {
      await deleteFeeCategoryAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}

export function DeleteStructureButton({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(async () => {
      await deleteFeeStructureAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}
