"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitApplicationAction, type ApplyFormState } from "./actions";

const initialState: ApplyFormState = { status: "idle" };

export function ApplyForm({
  slug,
  classGroups,
}: {
  slug: string;
  classGroups: { id: string; name: string }[];
}) {
  const action = submitApplicationAction.bind(null, slug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="childFirstName">Child&apos;s first name</Label>
          <Input id="childFirstName" name="childFirstName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="childLastName">Child&apos;s last name</Label>
          <Input id="childLastName" name="childLastName" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Select id="gender" name="gender" defaultValue="">
            <option value="">Prefer not to say</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="desiredClassGroupId">Desired class</Label>
        <Select id="desiredClassGroupId" name="desiredClassGroupId" defaultValue="">
          <option value="">Not sure yet</option>
          {classGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addressLine">Home address</Label>
        <Textarea id="addressLine" name="addressLine" rows={2} />
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-foreground">Parent / guardian details</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="parentName">Full name</Label>
            <Input id="parentName" name="parentName" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="parentEmail">Email</Label>
              <Input id="parentEmail" name="parentEmail" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone">Phone</Label>
              <Input id="parentPhone" name="parentPhone" required />
            </div>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Submitting..." : "Submit application"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
