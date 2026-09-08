"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmApplicationFeePaidAction } from "../actions";

export function ConfirmFeeButton({ applicantId }: { applicantId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await confirmApplicationFeePaidAction(applicantId);
          router.refresh();
        })
      }
    >
      Confirm fee received
    </Button>
  );
}
