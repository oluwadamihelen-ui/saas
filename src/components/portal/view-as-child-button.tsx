"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { viewAsStudentAction } from "@/app/actions/view-as";

export function ViewAsChildButton({
  studentId,
  label = "View portal",
  variant = "outline",
  size = "sm",
}: {
  studentId: string;
  label?: string;
  variant?: "outline" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const [isPending, run] = useSafeAction();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={() => run(() => viewAsStudentAction(studentId))}
    >
      <Eye className="h-4 w-4" />
      {isPending ? "Opening..." : label}
    </Button>
  );
}
