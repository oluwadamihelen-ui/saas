"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSafeAction } from "@/hooks/use-safe-action";
import { setNotificationPreferenceAction, setNotificationChannelPreferenceAction } from "@/lib/actions/notifications";
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
  LIBRARY: "Library (due/overdue books)",
  TRANSPORT: "Transport",
  PAYROLL: "Payroll",
  HR: "HR (staff invites, etc.)",
};

interface ChannelState {
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export function NotificationPreferencesForm({
  categories,
  initial,
  initialChannels,
  emailAvailable,
  smsAvailable,
}: {
  categories: NotificationCategory[];
  initial: Record<NotificationCategory, boolean>;
  initialChannels?: Record<NotificationCategory, ChannelState>;
  emailAvailable?: boolean;
  smsAvailable?: boolean;
}) {
  const [state, setState] = useState(initial);
  const [channelState, setChannelState] = useState(initialChannels);
  const [pendingCategory, setPendingCategory] = useState<NotificationCategory | null>(null);
  const [pendingChannel, setPendingChannel] = useState<`${NotificationCategory}:${"email" | "sms"}` | null>(null);
  const [isPending, run] = useSafeAction();

  function handleToggle(category: NotificationCategory) {
    const next = !state[category];
    setState((prev) => ({ ...prev, [category]: next }));
    setPendingCategory(category);
    run(async () => {
      await setNotificationPreferenceAction(category, next);
      setPendingCategory(null);
    });
  }

  function handleChannelToggle(category: NotificationCategory, channel: "email" | "sms") {
    if (!channelState) return;
    const field = channel === "email" ? "emailEnabled" : "smsEnabled";
    const next = !channelState[category][field];
    setChannelState((prev) => (prev ? { ...prev, [category]: { ...prev[category], [field]: next } } : prev));
    setPendingChannel(`${category}:${channel}`);
    run(async () => {
      await setNotificationChannelPreferenceAction(category, channel, next);
      setPendingChannel(null);
    });
  }

  const showChannels = Boolean(channelState) && (emailAvailable || smsAvailable);

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
        <div key={category} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="text-sm text-foreground">{CATEGORY_LABELS[category] ?? category}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={state[category] ? "primary" : "outline"}
              onClick={() => handleToggle(category)}
              disabled={isPending && pendingCategory === category}
              aria-pressed={state[category]}
            >
              {state[category] ? "In-app: On" : "In-app: Off"}
            </Button>
            {showChannels && emailAvailable && (
              <Button
                size="sm"
                variant={channelState![category].emailEnabled ? "primary" : "outline"}
                onClick={() => handleChannelToggle(category, "email")}
                disabled={isPending && pendingChannel === `${category}:email`}
                aria-pressed={channelState![category].emailEnabled}
              >
                {channelState![category].emailEnabled ? "Email: On" : "Email: Off"}
              </Button>
            )}
            {showChannels && smsAvailable && (
              <Button
                size="sm"
                variant={channelState![category].smsEnabled ? "primary" : "outline"}
                onClick={() => handleChannelToggle(category, "sms")}
                disabled={isPending && pendingChannel === `${category}:sms`}
                aria-pressed={channelState![category].smsEnabled}
              >
                {channelState![category].smsEnabled ? "SMS: On" : "SMS: Off"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
