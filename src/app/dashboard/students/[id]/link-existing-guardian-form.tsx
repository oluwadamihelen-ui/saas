"use client";

import { useActionState, useState, useTransition } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchGuardiansAction, linkExistingGuardianAction, type LinkGuardianState } from "../actions";

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

export function LinkExistingGuardianForm({ studentId }: { studentId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuardianResult[]>([]);
  const [selected, setSelected] = useState<GuardianResult | null>(null);
  const [isSearching, startSearch] = useTransition();

  const action = linkExistingGuardianAction.bind(null, studentId);
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as LinkGuardianState);
  useActionToast(state);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      setResults(await searchGuardiansAction(value));
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">Link an existing guardian</p>
      <p className="text-xs text-muted">
        Use this when this student shares a parent/guardian who&apos;s already on file for another student — so their
        portal login shows every child, instead of creating a second, separate guardian record.
      </p>

      {!selected ? (
        <div className="space-y-2">
          <Input
            placeholder="Search by name, phone or email..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          {isSearching && <p className="text-xs text-muted">Searching...</p>}
          {results.length > 0 && (
            <div className="divide-y divide-border rounded-md border border-border">
              {results.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelected(g)}
                  className="flex w-full flex-col items-start gap-0.5 p-3 text-left text-sm hover:bg-muted-surface"
                >
                  <span className="font-medium text-foreground">
                    {g.firstName} {g.lastName}
                    {g.hasPortalLogin && <span className="ml-2 text-xs font-normal text-success">Has portal login</span>}
                  </span>
                  <span className="text-xs text-muted">{g.phone}{g.email ? ` · ${g.email}` : ""}</span>
                  {g.students.length > 0 && (
                    <span className="text-xs text-muted">Already guardian of: {g.students.join(", ")}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {!isSearching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted">No matching guardians found.</p>
          )}
        </div>
      ) : (
        <form action={formAction} className="space-y-3 rounded-md bg-muted-surface p-3">
          <input type="hidden" name="guardianId" value={selected.id} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{selected.firstName} {selected.lastName}</p>
              <p className="text-xs text-muted">{selected.phone}{selected.email ? ` · ${selected.email}` : ""}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-relationship">Relationship to this student</Label>
            <Select id="link-relationship" name="relationship" required defaultValue="">
              <option value="" disabled>Select</option>
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Linking..." : "Link guardian"}</Button>
          {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        </form>
      )}
    </div>
  );
}
