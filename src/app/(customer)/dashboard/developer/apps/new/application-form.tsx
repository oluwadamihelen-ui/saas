"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitApplicationAction, type SubmitApplicationState } from "../../actions";

const initial: SubmitApplicationState = { status: "idle" };

export function DeveloperApplicationForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(submitApplicationAction, initial);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="my-app" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" required>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="licensePrice">License price (USD)</Label>
          <Input id="licensePrice" name="licensePrice" type="number" step="0.01" min={0.01} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="shortDescription">Short description</Label>
          <Input id="shortDescription" name="shortDescription" required maxLength={200} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fullDescription">Full description</Label>
          <Textarea id="fullDescription" name="fullDescription" required rows={6} />
        </div>
      </div>

      <p className="text-sm text-muted">
        Submitting adds your app to the review queue as a draft. Our team will configure its deployment specification and publish it once approved.
      </p>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit for Review"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
