"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmPendingPaymentAction, rejectPendingPaymentAction } from "./actions";

export function PendingPaymentButtons({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(async () => {
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
        onClick={() => startTransition(async () => {
          await rejectPendingPaymentAction(invoiceId, paymentId);
          router.refresh();
        })}
      >
        Reject
      </Button>
    </div>
  );
}
