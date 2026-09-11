"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { createDirectStaffAction, type DirectCreateState } from "./actions";

const initialState: DirectCreateState = { status: "idle" };

export function DirectCreateForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createDirectStaffAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  if (state.status === "success" && state.user && state.inviteToken) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-success">User created successfully</p>
          <p className="text-xs text-muted">The account exists now — role and permissions already apply.</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm">
          <div><dt className="text-xs text-muted">Name</dt><dd className="text-foreground">{state.user.name}</dd></div>
          <div><dt className="text-xs text-muted">Email</dt><dd className="text-foreground">{state.user.email}</dd></div>
          <div><dt className="text-xs text-muted">Staff ID</dt><dd className="text-foreground">{state.user.staffId ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted">Role</dt><dd className="text-foreground">{state.user.roleName}</dd></div>
          <div className="col-span-2">
            <dt className="text-xs text-muted">Account status</dt>
            <dd><Badge variant="warning">Password setup pending</Badge></dd>
          </div>
        </dl>
        <div className="space-y-1.5 rounded-md bg-muted-surface p-4">
          <p className="text-sm font-medium text-foreground">Password setup link</p>
          <p className="text-xs text-muted">
            Schoolum doesn&apos;t send emails — copy this link and share it with them directly (chat, SMS, in person). It
            expires in 7 days and can be regenerated any time from All Users.
          </p>
          <CopyLinkButton path={`/invite/${state.inviteToken}`} label="Copy password setup link" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => window.location.reload()}>Create another user</Button>
          <Button asChild variant="secondary"><Link href="/dashboard/administration/users">Go to All Users</Link></Button>
          <Button asChild variant="secondary"><Link href="/dashboard/staff">Back to staff directory</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required placeholder="Jane Doe" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="jane@school.edu" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roleId">Role</Label>
          <Select id="roleId" name="roleId" required defaultValue="">
            <option value="" disabled>Select role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="08012345678" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staffId">Staff ID</Label>
          <Input id="staffId" name="staffId" placeholder="Optional — unique within your school" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input id="jobTitle" name="jobTitle" placeholder="e.g. Senior Teacher" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <Input id="department" name="department" placeholder="e.g. Sciences" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Select id="gender" name="gender" defaultValue="">
            <option value="">Unspecified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create account"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
