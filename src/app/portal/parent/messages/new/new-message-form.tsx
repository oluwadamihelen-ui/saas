"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startConversationAction, type MessageFormState } from "../actions";

const initialState: MessageFormState = { status: "idle" };

export function NewMessageForm({ kids }: { kids: { id: string; firstName: string; lastName: string }[] }) {
  const [state, formAction, isPending] = useActionState(startConversationAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required placeholder="Question about pickup times" />
      </div>
      {kids.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="studentId">Which child is this about? (optional)</Label>
          <Select id="studentId" name="studentId" defaultValue="">
            <option value="">General question</option>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>{k.firstName} {k.lastName}</option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" required rows={5} placeholder="Write your message..." />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Sending..." : "Send message"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
