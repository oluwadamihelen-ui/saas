"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addDnsRecordAdmin, type DomainActionState } from "../actions";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"] as const;
const initial: DomainActionState = { status: "idle" };

export function DnsRecordForm({ domainId }: { domainId: string }) {
  const [state, formAction, isPending] = useActionState(addDnsRecordAdmin.bind(null, domainId), initial);
  const [type, setType] = React.useState<string>("A");
  const needsPriority = type === "MX" || type === "SRV";

  return (
    <form action={formAction} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="type">Type</Label>
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {RECORD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="www" required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="value">Value</Label>
        <Input id="value" name="value" placeholder="203.0.113.10" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ttl">TTL (seconds)</Label>
        <Input id="ttl" name="ttl" type="number" defaultValue={3600} />
      </div>
      {needsPriority && (
        <div className="space-y-1">
          <Label htmlFor="priority">Priority</Label>
          <Input id="priority" name="priority" type="number" defaultValue={10} required />
        </div>
      )}
      <div className="flex items-end sm:col-span-4">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding..." : "Add record"}
        </Button>
      </div>
      {state.status === "error" && <p className="text-sm text-danger sm:col-span-4">{state.message}</p>}
    </form>
  );
}
