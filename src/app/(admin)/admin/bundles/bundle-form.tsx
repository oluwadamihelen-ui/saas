"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BundleFormState } from "./actions";

const initial: BundleFormState = { status: "idle" };

interface Item {
  key: number;
  type: "APPLICATION" | "DOMAIN" | "HOSTING_PLAN" | "SERVICE";
  applicationId: string;
  hostingPlanId: string;
  serviceLabel: string;
  quantity: string;
}

export interface BundleFormValues {
  name: string;
  slug: string;
  description: string;
  price: number;
  items: Item[];
}

export function BundleForm({
  action,
  applications,
  hostingPlans,
  defaultValues,
  submitLabel = "Save Bundle",
}: {
  action: (prev: BundleFormState, formData: FormData) => Promise<BundleFormState>;
  applications: { id: string; name: string }[];
  hostingPlans: { id: string; name: string }[];
  defaultValues?: Partial<BundleFormValues>;
  submitLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initial);
  const [items, setItems] = React.useState<Item[]>(
    defaultValues?.items?.length
      ? defaultValues.items
      : [{ key: 0, type: "APPLICATION", applicationId: applications[0]?.id ?? "", hostingPlanId: "", serviceLabel: "", quantity: "1" }]
  );
  const nextKey = React.useRef(items.length);

  const addItem = () =>
    setItems((prev) => [...prev, { key: nextKey.current++, type: "APPLICATION", applicationId: applications[0]?.id ?? "", hostingPlanId: "", serviceLabel: "", quantity: "1" }]);
  const removeItem = (key: number) => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  const updateItem = (key: number, field: keyof Omit<Item, "key">, value: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={defaultValues?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" required pattern="[a-z0-9-]+" defaultValue={defaultValues?.slug} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={defaultValues?.description} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Bundle price (USD)</Label>
            <Input id="price" name="price" type="number" step="0.01" min={0.01} required defaultValue={defaultValues?.price} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Bundle Items</h2>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-[140px_1fr_80px_auto] items-end gap-2 rounded-md border border-border p-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={item.type} onChange={(e) => updateItem(item.key, "type", e.target.value)}>
                  <option value="APPLICATION">Application</option>
                  <option value="HOSTING_PLAN">Hosting Plan</option>
                  <option value="DOMAIN">Domain</option>
                  <option value="SERVICE">Service</option>
                </Select>
                <input type="hidden" name="itemType" value={item.type} />
              </div>

              {item.type === "APPLICATION" && (
                <div className="space-y-1">
                  <Label>Application</Label>
                  <Select name="itemApplicationId" value={item.applicationId} onChange={(e) => updateItem(item.key, "applicationId", e.target.value)}>
                    <option value="">Select an application</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {item.type === "HOSTING_PLAN" && (
                <div className="space-y-1">
                  <Label>Hosting Plan</Label>
                  <Select name="itemHostingPlanId" value={item.hostingPlanId} onChange={(e) => updateItem(item.key, "hostingPlanId", e.target.value)}>
                    <option value="">Select a plan</option>
                    {hostingPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {(item.type === "DOMAIN" || item.type === "SERVICE") && (
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input
                    name="itemServiceLabel"
                    placeholder={item.type === "DOMAIN" ? "1 year domain registration" : "e.g. Priority support"}
                    value={item.serviceLabel}
                    onChange={(e) => updateItem(item.key, "serviceLabel", e.target.value)}
                  />
                </div>
              )}
              {item.type !== "APPLICATION" && <input type="hidden" name="itemApplicationId" value="" />}
              {item.type !== "HOSTING_PLAN" && <input type="hidden" name="itemHostingPlanId" value="" />}
              {item.type !== "DOMAIN" && item.type !== "SERVICE" && <input type="hidden" name="itemServiceLabel" value="" />}

              <div className="space-y-1">
                <Label>Qty</Label>
                <Input name="itemQuantity" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.key, "quantity", e.target.value)} />
              </div>

              <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(item.key)} disabled={items.length === 1}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={addItem}>
          Add item
        </Button>
      </section>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving..." : submitLabel}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
