"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { resendInviteAction, convertInviteAction, regenerateSetupLinkAction, type ConvertInviteState } from "./actions";

export function ResendInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await resendInviteAction(inviteId);
          router.refresh();
        })
      }
    >
      {isPending ? "Resending..." : "Resend"}
    </Button>
  );
}

/// For a directly-created staff member whose status is still INVITED —
/// regenerates their password-setup link (invalidating any earlier one)
/// and shows it to copy, without navigating away from the directory.
export function RegenerateSetupLinkButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !token && !isPending) {
      startTransition(async () => {
        const result = await regenerateSetupLinkAction(userId);
        if ("error" in result) setError(result.error);
        else setToken(result.token);
        router.refresh();
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">Get setup link</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password setup link</DialogTitle>
          <DialogDescription>
            {isPending
              ? "Generating a new link…"
              : error
                ? error
                : `Share this with ${name} directly — any earlier link for them stops working as soon as this one is created.`}
          </DialogDescription>
        </DialogHeader>
        {token && <CopyLinkButton path={`/invite/${token}`} label="Copy password setup link" />}
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="ghost">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const initialState: ConvertInviteState = { status: "idle" };

/// "Create account now" — collects the one field a pending
/// ACCOUNT_INVITATION never had (name), converts it to a real account,
/// and hands back a password-setup link to copy — see convertInviteToDirect.
export function ConvertInviteButton({ inviteId, email }: { inviteId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(convertInviteAction, initialState);
  const router = useRouter();

  // The server action deliberately doesn't revalidate the page itself (see
  // convertInviteAction) — this component sits behind a condition
  // (invite.purpose === "ACCOUNT_INVITATION") that the conversion flips,
  // so an immediate server-driven refresh would unmount this dialog before
  // the admin can copy the link. Refresh only once they're done with it.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && state.status === "success") router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">Create account now</Button>
      </DialogTrigger>
      <DialogContent>
        {state.status === "success" && state.inviteToken ? (
          <>
            <DialogHeader>
              <DialogTitle>Account created</DialogTitle>
              <DialogDescription>{email} now has an account. Copy this password setup link and share it with them.</DialogDescription>
            </DialogHeader>
            <CopyLinkButton path={`/invite/${state.inviteToken}`} label="Copy password setup link" />
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="inviteId" value={inviteId} />
            <DialogHeader>
              <DialogTitle>Create account now</DialogTitle>
              <DialogDescription>
                Creates the account for {email} immediately instead of waiting for them to accept the invitation. You&apos;ll
                get a password setup link to share with them directly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="convert-name">Full name</Label>
              <Input id="convert-name" name="name" required placeholder="Jane Doe" />
            </div>
            {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create account"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
