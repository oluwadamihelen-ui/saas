"use client";

import { useActionState, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchGuardiansAction, mergeGuardiansAction, type MergeGuardianState } from "../actions";

import { useActionToast } from "@/hooks/use-action-toast";

interface GuardianResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  hasPortalLogin: boolean;
  students: string[];
}

/// For a guardian record that turns out to be a duplicate of one already
/// on file for another student — folds it into the real one instead of
/// leaving two separate records only one of which can ever hold that
/// parent's portal login.
export function MergeGuardianButton({
  studentId,
  guardianId,
  guardianName,
  guardianHasPortalLogin,
}: {
  studentId: string;
  guardianId: string;
  guardianName: string;
  guardianHasPortalLogin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuardianResult[]>([]);
  const [target, setTarget] = useState<GuardianResult | null>(null);
  const [isSearching, startSearch] = useTransition();

  const action = mergeGuardiansAction.bind(null, studentId, target?.id ?? "");
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as MergeGuardianState);
  useActionToast(state);

  function handleQueryChange(value: string) {
    setQuery(value);
    setTarget(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const all = await searchGuardiansAction(value);
      setResults(all.filter((g) => g.id !== guardianId));
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Merge into another guardian
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-border p-3">
      <p className="text-xs text-muted">
        Search for the guardian record that&apos;s actually the same person as <strong>{guardianName}</strong>.{" "}
        {guardianName} will be removed and every student linked to them will move to whichever one you pick.
      </p>
      {!target ? (
        <>
          <Input placeholder="Search by name, phone or email..." value={query} onChange={(e) => handleQueryChange(e.target.value)} />
          {isSearching && <p className="text-xs text-muted">Searching...</p>}
          {results.length > 0 && (
            <div className="divide-y divide-border rounded-md border border-border">
              {results.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTarget(g)}
                  className="flex w-full flex-col items-start gap-0.5 p-3 text-left text-sm hover:bg-muted-surface"
                >
                  <span className="font-medium text-foreground">
                    {g.firstName} {g.lastName}
                    {g.hasPortalLogin && <span className="ml-2 text-xs font-normal text-success">Has portal login</span>}
                  </span>
                  <span className="text-xs text-muted">{g.phone}{g.email ? ` · ${g.email}` : ""}</span>
                  {g.students.length > 0 && <span className="text-xs text-muted">Already guardian of: {g.students.join(", ")}</span>}
                </button>
              ))}
            </div>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </>
      ) : (
        <form action={formAction} className="space-y-2 rounded-md bg-muted-surface p-3">
          <input type="hidden" name="removeGuardianId" value={guardianId} />
          <p className="text-sm text-foreground">
            Merge <strong>{guardianName}</strong> into <strong>{target.firstName} {target.lastName}</strong>?
          </p>
          {guardianHasPortalLogin && target.hasPortalLogin && (
            <p className="text-sm text-danger">
              Both have their own portal login — this merge will be rejected. Remove one login first, or ask support for help.
            </p>
          )}
          {guardianHasPortalLogin && !target.hasPortalLogin && (
            <p className="text-xs text-muted">{guardianName}&apos;s portal login will move over to {target.firstName} {target.lastName}.</p>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Merging..." : "Confirm merge"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)}>Change</Button>
          </div>
          {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        </form>
      )}
    </div>
  );
}
