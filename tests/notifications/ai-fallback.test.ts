import { describe, it, expect } from "vitest";
import { isNotificationAiConfigured } from "@/lib/services/notification-ai-summary";

describe("AI-unavailable fallback (brief section 37/42)", () => {
  it("reports AI as not configured when no provider API key is set (this test environment's actual state)", () => {
    // No OPENAI_API_KEY/ANTHROPIC_API_KEY is set for the test run, so
    // getAiProvider() returns null and this must be false — proving the
    // deployment-without-AI-keys path is real, not just asserted in a
    // doc comment. generateNotificationsAiSummaryAction (actions/
    // notifications.ts) checks this exact function before ever calling
    // the AI provider, and returns a plain { ok: false, error } result
    // instead of throwing — the rest of the Notification Center
    // (deterministic rules, the bell, the /notifications page, read/
    // delete/preferences) never calls this function at all, so none of
    // it depends on AI being configured.
    expect(isNotificationAiConfigured()).toBe(false);
  });
});
