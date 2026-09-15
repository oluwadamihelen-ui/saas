"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { markInquiryReviewedAction } from "./actions";

export function InquiryActions({ inquiryId }: { inquiryId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  function mark(status: "CONTACTED" | "CONVERTED" | "DECLINED") {
    run(async () => {
      await markInquiryReviewedAction(inquiryId, status);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={isPending} onClick={() => mark("CONTACTED")}>Mark contacted</Button>
      <Button size="sm" variant="secondary" disabled={isPending} onClick={() => mark("CONVERTED")}>Mark converted</Button>
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => mark("DECLINED")}>Decline</Button>
    </div>
  );
}
