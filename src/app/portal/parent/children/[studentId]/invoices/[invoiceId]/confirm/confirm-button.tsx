"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { confirmMockPaymentAction } from "@/app/pay/[token]/actions";

export function ConfirmButton({ reference, studentId, invoiceId }: { reference: string; studentId: string; invoiceId: string }) {
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
          await confirmMockPaymentAction(reference);
          setDone(true);
          setTimeout(() => router.push(`/portal/parent/children/${studentId}/invoices/${invoiceId}`), 1200);
        })
      }
    >
      {isPending ? "Confirming..." : "Confirm payment"}
    </Button>
  );
}
