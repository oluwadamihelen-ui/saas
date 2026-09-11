"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setNotificationPreferenceAction } from "@/lib/actions/notifications";
import type { NotificationCategory } from "@/generated/prisma/client";

const CATEGORY_LABELS: Partial<Record<NotificationCategory, string>> = {
  ACADEMIC: "Academic (performance, risk alerts)",
  ATTENDANCE: "Attendance",
  ASSIGNMENT: "Assignments",
  EXAM: "Exams",
  RESULT: "Results & report cards",
  FEES: "Fees",
  PAYMENT: "Payments",
  ANNOUNCEMENT: "Announcements",
  ONLINE_CLASS: "Online classes & lectures",
  MESSAGING: "Messages",
  BIRTHDAY: "Birthdays",
  AI_INSIGHT: "AI insights",
};

export function NotificationPreferencesForm({
  categories,
  initial,
}: {
  categories: NotificationCategory[];
  initial: Record<NotificationCategory, boolean>;
}) {
  const [state, setState] = useState(initial);
  const [pendingCategory, setPendingCategory] = useState<NotificationCategory | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(category: NotificationCategory) {
    const next = !state[category];
    setState((prev) => ({ ...prev, [category]: next }));
    setPendingCategory(category);
    startTransition(async () => {
      await setNotificationPreferenceAction(category, next);
      setPendingCategory(null);
    });
  }

  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-foreground">System notifications</p>
          <p className="text-xs text-muted">Account, billing and trial notices — always on.</p>
        </div>
        <Badge variant="neutral">Always on</Badge>
      </div>
      {categories.map((category) => (
        <div key={category} className="flex items-center justify-between py-3">
          <p className="text-sm text-foreground">{CATEGORY_LABELS[category] ?? category}</p>
          <Button
            size="sm"
            variant={state[category] ? "primary" : "outline"}
            onClick={() => handleToggle(category)}
            disabled={isPending && pendingCategory === category}
            aria-pressed={state[category]}
          >
            {state[category] ? "On" : "Off"}
          </Button>
        </div>
      ))}
    </div>
  );
}
