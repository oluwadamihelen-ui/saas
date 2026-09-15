"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { confirmApplicationFeePaidAction } from "../actions";

export function ConfirmFeeButton({ applicantId }: { applicantId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await confirmApplicationFeePaidAction(applicantId);
          router.refresh();
        })
      }
    >
      Confirm fee received
    </Button>
  );
}
