"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestDeployment, type RequestDeploymentState } from "../actions";

interface AppOption {
  id: string;
  name: string;
  versions: { id: string; version: string; isLatest: boolean }[];
}

interface HostingOption {
  id: string;
  name: string;
  domain: string | null;
}

const initial: RequestDeploymentState = { status: "idle" };

export function DeployApplicationForm({ applications, hostingAccounts }: { applications: AppOption[]; hostingAccounts: HostingOption[] }) {
  const [state, formAction, isPending] = useActionState(requestDeployment, initial);
  const [applicationId, setApplicationId] = React.useState(applications[0]?.id ?? "");
  const [deploymentType, setDeploymentType] = React.useState<"MANAGED" | "PLATFORM_HOSTING" | "CUSTOMER_SERVER">("MANAGED");

  const selectedApp = applications.find((a) => a.id === applicationId);

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-border bg-surface p-6">
      <div className="space-y-1.5">
        <Label htmlFor="applicationId">Application</Label>
        <Select id="applicationId" name="applicationId" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="applicationVersionId">Version</Label>
        <Select id="applicationVersionId" name="applicationVersionId" defaultValue={selectedApp?.versions[0]?.id}>
          {selectedApp?.versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version} {v.isLatest ? "(latest)" : ""}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Deployment option</Label>
        {[
          { value: "MANAGED", title: "Request managed deployment", description: "Our team deploys and configures everything for you." },
          { value: "PLATFORM_HOSTING", title: "Use hosting from us", description: "Deploy to one of your active hosting accounts.", disabled: hostingAccounts.length === 0 },
          { value: "CUSTOMER_SERVER", title: "Deploy to my server", description: "Provide your server details and we deploy remotely." },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-md border p-4 ${opt.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${deploymentType === opt.value ? "border-accent bg-accent-soft" : "border-border"}`}
          >
            <input
              type="radio"
              name="deploymentType"
              value={opt.value}
              checked={deploymentType === opt.value}
              disabled={opt.disabled}
              onChange={() => setDeploymentType(opt.value as never)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-foreground">{opt.title}</p>
              <p className="text-xs text-muted">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {deploymentType === "PLATFORM_HOSTING" && (
        <div className="space-y-1.5">
          <Label htmlFor="hostingAccountId">Hosting account</Label>
          <Select id="hostingAccountId" name="hostingAccountId">
            {hostingAccounts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} {h.domain ? `— ${h.domain}` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      {deploymentType === "CUSTOMER_SERVER" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hostname">Server hostname or IP</Label>
            <Input id="hostname" name="hostname" placeholder="203.0.113.10" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="port">SSH port</Label>
            <Input id="port" name="port" type="number" defaultValue={22} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sshUsername">SSH username</Label>
            <Input id="sshUsername" name="sshUsername" placeholder="root, ubuntu, deploy..." required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="operatingSystem">Operating system</Label>
            <Input id="operatingSystem" name="operatingSystem" placeholder="Ubuntu 22.04" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="controlPanel">Control panel (optional)</Label>
            <Input id="controlPanel" name="controlPanel" placeholder="cPanel, Plesk, none..." />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sshKey">SSH private key</Label>
            <Textarea id="sshKey" name="sshKey" rows={5} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----" required />
            <p className="text-xs text-muted">
              Stored encrypted, used only to connect to this server for deployments. We recommend creating a
              dedicated deploy key (rather than reusing your personal key) and adding it to this server&apos;s
              <code className="mx-1 rounded bg-muted-surface px-1 py-0.5">authorized_keys</code> for the SSH username above.
            </p>
          </div>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Starting deployment..." : "Deploy Your Application"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
