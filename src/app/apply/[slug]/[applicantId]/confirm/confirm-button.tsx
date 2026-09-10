"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmApplicationFeeOnlineAction } from "../../actions";

export function ConfirmButton({ reference, slug, applicantId }: { reference: string; slug: string; applicantId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  if (done) {
    return <p className="text-sm font-medium text-success">Payment confirmed. Redirecting…</p>;
  }

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await confirmApplicationFeeOnlineAction(reference);
          setDone(true);
          setTimeout(() => router.push(`/apply/${slug}/${applicantId}`), 1200);
        })
      }
    >
      {isPending ? "Confirming..." : "Confirm payment"}
    </Button>
  );
}
