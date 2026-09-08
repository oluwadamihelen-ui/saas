"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteFeeCategoryAction, deleteFeeStructureAction } from "./actions";

export function DeleteCategoryButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(async () => {
      await deleteFeeCategoryAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}

export function DeleteStructureButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(async () => {
      await deleteFeeStructureAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}
