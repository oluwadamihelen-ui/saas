"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmAiToolCallAction, declineAiToolCallAction } from "../actions";

const TOOL_LABELS: Record<string, string> = {
  get_dashboard_summary: "Check the dashboard summary",
  find_student: "Search for a student",
  get_student_profile: "Look up a student's profile",
  get_todays_attendance_summary: "Check today's attendance",
  get_student_attendance: "Check a student's attendance",
  get_student_results: "Check a student's results",
  get_student_fees: "Check a student's fees",
  get_finance_summary: "Check the finance summary",
  mark_student_attendance: "Mark a student's attendance",
};

export interface ToolCallMessage {
  id: string;
  toolName: string | null;
  toolArgs: unknown;
  toolResult: unknown;
  toolStatus: "PROPOSED" | "EXECUTED" | "DECLINED" | null;
}

export function ToolCallCard({ conversationId, message }: { conversationId: string; message: ToolCallMessage }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const label = (message.toolName && TOOL_LABELS[message.toolName]) || message.toolName || "Tool call";
  const args = (message.toolArgs as Record<string, unknown> | null) ?? {};
  const argEntries = Object.entries(args).filter(([, v]) => v !== undefined && v !== "");

  return (
    <Card className="max-w-lg border-dashed">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {message.toolStatus === "PROPOSED" && <Badge variant="warning">Needs confirmation</Badge>}
          {message.toolStatus === "EXECUTED" && <Badge variant="success">Done</Badge>}
          {message.toolStatus === "DECLINED" && <Badge variant="neutral">Declined</Badge>}
        </div>
        {argEntries.length > 0 && (
          <p className="text-xs text-muted">
            {argEntries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
          </p>
        )}
        {message.toolStatus === "EXECUTED" && (
          <pre className="overflow-x-auto rounded-md bg-muted-surface p-2 text-xs text-foreground">
            {JSON.stringify(message.toolResult, null, 2)}
          </pre>
        )}
        {message.toolStatus === "PROPOSED" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await confirmAiToolCallAction(conversationId, message.id);
                  router.refresh();
                })
              }
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await declineAiToolCallAction(conversationId, message.id);
                  router.refresh();
                })
              }
            >
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
