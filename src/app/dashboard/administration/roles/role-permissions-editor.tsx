"use client";

import { useActionState, useMemo, useState } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveRolePermissions, type RolePermissionsState } from "./actions";
import type { RoleWithPermissions } from "@/lib/services/role-permissions";

const initialState: RolePermissionsState = { status: "idle" };

const MODULE_LABEL_OVERRIDES: Record<string, string> = {
  cbt: "CBT",
  hr: "HR",
};

function moduleLabel(module: string): string {
  if (MODULE_LABEL_OVERRIDES[module]) return MODULE_LABEL_OVERRIDES[module];
  return module
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function RolePermissionsEditor({
  roles,
  catalog,
  currentUserRoleKey,
}: {
  roles: RoleWithPermissions[];
  catalog: { key: string; module: string; description: string }[];
  currentUserRoleKey: string;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];

  const groups = useMemo(() => {
    const byModule = new Map<string, { key: string; description: string }[]>();
    for (const p of catalog) {
      if (!byModule.has(p.module)) byModule.set(p.module, []);
      byModule.get(p.module)!.push({ key: p.key, description: p.description });
    }
    return [...byModule.entries()];
  }, [catalog]);

  if (!selectedRole) return <p className="text-sm text-muted">No roles found.</p>;

  return (
    <div className="space-y-6">
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="roleSelect">Role</Label>
        <Select id="roleSelect" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>

      {selectedRole.isLocked ? (
        <p className="text-sm text-muted">
          The <span className="font-medium text-foreground">{selectedRole.name}</span> role always has full access to
          every permission, and can&apos;t be limited — every school needs at least one role that can undo any other
          role&apos;s misconfiguration.
        </p>
      ) : (
        // Remounts only when switching to a different role, so its
        // uncontrolled checkboxes' defaultChecked starts from the right
        // role. Deliberately NOT keyed on permissionKeys too: a successful
        // save changes permissionKeys via the same server refresh that
        // updates useActionState's returned status — keying on it as well
        // would remount the form (and wipe out the just-set "Saved."
        // message) at the exact moment it should appear. The checkboxes'
        // current DOM state after a save already IS the new saved state,
        // so there's nothing to resync within the same role anyway.
        <RoleForm
          key={selectedRole.id}
          role={selectedRole}
          groups={groups}
          isOwnRole={selectedRole.key === currentUserRoleKey}
        />
      )}
    </div>
  );
}

function RoleForm({
  role,
  groups,
  isOwnRole,
}: {
  role: RoleWithPermissions;
  groups: [string, { key: string; description: string }[]][];
  isOwnRole: boolean;
}) {
  const [state, formAction, isPending] = useActionState(saveRolePermissions, initialState);
  const checkedSet = new Set(role.permissionKeys);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="roleId" value={role.id} />
      {isOwnRole && (
        <p className="text-xs text-muted">
          This is your own role — unchecking &quot;Change role permission assignments&quot; for it will be rejected,
          so you can&apos;t accidentally lock yourself out of this page.
        </p>
      )}
      <div className="space-y-5">
        {groups.map(([module, permissions]) => (
          <div key={module}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{moduleLabel(module)}</h3>
            <div className="space-y-2">
              {permissions.map((p) => {
                const isRolesManage = p.key === "roles.manage";
                const isProtected = isOwnRole && isRolesManage;
                return (
                  <label key={p.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="permissionKeys"
                      value={p.key}
                      defaultChecked={checkedSet.has(p.key)}
                      // Deliberately NOT disabled: a disabled checkbox is
                      // dropped from FormData entirely, which would make
                      // every save of your own role fail the server's
                      // self-lockout guard. Left enabled so unchecking it
                      // is possible but rejected server-side with a clear
                      // message (see updateRolePermissions).
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <span className={isProtected ? "text-muted" : "text-foreground"}>{p.description}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save changes"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
