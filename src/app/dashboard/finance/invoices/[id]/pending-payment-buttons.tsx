"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { confirmPendingPaymentAction, rejectPendingPaymentAction } from "./actions";

export function PendingPaymentButtons({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => run(async () => {
          await confirmPendingPaymentAction(invoiceId, paymentId);
          router.refresh();
        })}
      >
        Confirm
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => run(async () => {
          await rejectPendingPaymentAction(invoiceId, paymentId);
          router.refresh();
        })}
      >
        Reject
      </Button>
    </div>
  );
}
