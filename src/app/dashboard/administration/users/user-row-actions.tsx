"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { changeRoleAction, setUserStatusAction, type ChangeRoleState } from "./actions";

const initialState: ChangeRoleState = { status: "idle" };

/// isSelf gets an extra confirmation step — this app has no general role-
/// hierarchy/weight system, so the one hard rule (SCHOOL_OWNER can never
/// be assigned or removed here — enforced server-side in
/// changeUserRole) is what actually prevents losing administrative
/// access; this is the "at minimum require a strong confirmation" layer
/// for every other self-change.
export function ChangeRoleDialog({
  userId,
  currentRoleName,
  roles,
  isSelf,
}: {
  userId: string;
  currentRoleName: string;
  roles: { id: string; name: string }[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [state, formAction, isPending] = useActionState(changeRoleAction, initialState);
  const router = useRouter();

  // Closing the dialog on success is a state adjustment reacting to a
  // prop-like change (state.status), so it happens during render — React's
  // own pattern for this — rather than as a setState call inside an
  // effect. router.refresh() is a real side effect (not pure), so it
  // stays in a plain effect that never itself calls setState.
  const [lastHandledStatus, setLastHandledStatus] = useState(state.status);
  if (state.status !== lastHandledStatus) {
    setLastHandledStatus(state.status);
    if (state.status === "success") {
      setOpen(false);
      setConfirmed(false);
    }
  }

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">Change role</Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>Current role: {currentRoleName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="roleId">New role</Label>
            <Select id="roleId" name="roleId" required value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
              <option value="" disabled>Select role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </div>
          {isSelf && selectedRoleId && (
            <label className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
              <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              This is my own account — I understand this changes my own access immediately.
            </label>
          )}
          {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending || !selectedRoleId || (isSelf && !confirmed)}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SuspendReactivateButton({ userId, status }: { userId: string; status: "ACTIVE" | "SUSPENDED" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setUserStatusAction(userId, nextStatus);
          router.refresh();
        })
      }
    >
      {isPending ? "Saving..." : status === "ACTIVE" ? "Suspend" : "Reactivate"}
    </Button>
  );
}
