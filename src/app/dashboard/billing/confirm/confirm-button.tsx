"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { confirmMockSubscriptionPaymentAction } from "./actions";

export function ConfirmButton({ reference }: { reference: string }) {
  const [isPending, run] = useSafeAction();
  const [done, setDone] = useState(false);
  const router = useRouter();

  if (done) {
    return <p className="text-sm font-medium text-success">Payment confirmed. Redirecting…</p>;
  }

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await confirmMockSubscriptionPaymentAction(reference);
          setDone(true);
          setTimeout(() => router.push("/dashboard/billing"), 1200);
        })
      }
    >
      {isPending ? "Confirming..." : "Confirm payment"}
    </Button>
  );
}
