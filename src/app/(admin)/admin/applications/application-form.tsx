"use client";

import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ApplicationFormValues {
  name: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  fullDescription: string;
  currentVersion: string;
  technologyStack: string;
  whatsIncluded: string;
  whatsNotIncluded: string;
  requirements: string;
  demoUrl: string;
  demoUsername: string;
  demoPassword: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  licensePrice: number;
  installationPrice: number;
  customizationPrice: number;
  maintenancePrice: number;
  runtime: string;
  databaseType: string;
  buildCommand: string;
  startCommand: string;
  imageUrls: string;
  features: string;
}

export function ApplicationForm({
  action,
  categories,
  defaultValues,
  submitLabel = "Save Application",
}: {
  action: (formData: FormData) => void;
  categories: { id: string; name: string }[];
  defaultValues?: Partial<ApplicationFormValues>;
  submitLabel?: string;
}) {
  const v = defaultValues ?? {};

  return (
    <form action={action} className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={v.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" required pattern="[a-z0-9-]+" defaultValue={v.slug} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" name="categoryId" required defaultValue={v.categoryId}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentVersion">Version</Label>
            <Input id="currentVersion" name="currentVersion" required defaultValue={v.currentVersion ?? "1.0.0"} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="shortDescription">Short description</Label>
            <Input id="shortDescription" name="shortDescription" required maxLength={200} defaultValue={v.shortDescription} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fullDescription">Full description</Label>
            <Textarea id="fullDescription" name="fullDescription" required rows={6} defaultValue={v.fullDescription} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="technologyStack">Technology stack (comma-separated)</Label>
            <Input id="technologyStack" name="technologyStack" placeholder="Next.js, PostgreSQL, Redis" defaultValue={v.technologyStack} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="featured" defaultChecked={v.featured} /> Featured application
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Pricing</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="licensePrice">License price (USD)</Label>
            <Input id="licensePrice" name="licensePrice" type="number" step="0.01" min={0} required defaultValue={v.licensePrice} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="installationPrice">Installation fee</Label>
            <Input id="installationPrice" name="installationPrice" type="number" step="0.01" min={0} defaultValue={v.installationPrice} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customizationPrice">Customization (from)</Label>
            <Input id="customizationPrice" name="customizationPrice" type="number" step="0.01" min={0} defaultValue={v.customizationPrice} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maintenancePrice">Maintenance (/mo)</Label>
            <Input id="maintenancePrice" name="maintenancePrice" type="number" step="0.01" min={0} defaultValue={v.maintenancePrice} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Deployment Configuration</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="runtime">Runtime</Label>
            <Input id="runtime" name="runtime" placeholder="node20" required defaultValue={v.runtime} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="databaseType">Database</Label>
            <Input id="databaseType" name="databaseType" placeholder="postgresql" defaultValue={v.databaseType} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buildCommand">Build command</Label>
            <Input id="buildCommand" name="buildCommand" placeholder="npm run build" defaultValue={v.buildCommand} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startCommand">Start command</Label>
            <Input id="startCommand" name="startCommand" placeholder="npm start" defaultValue={v.startCommand} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Content</h2>
        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="imageUrls">Screenshot URLs (one per line)</Label>
            <Textarea id="imageUrls" name="imageUrls" rows={3} defaultValue={v.imageUrls} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="features">Features (one per line, &quot;Title: description&quot;)</Label>
            <Textarea id="features" name="features" rows={4} defaultValue={v.features} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="whatsIncluded">What&apos;s included (one per line)</Label>
              <Textarea id="whatsIncluded" name="whatsIncluded" rows={3} defaultValue={v.whatsIncluded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsNotIncluded">Not included (one per line)</Label>
              <Textarea id="whatsNotIncluded" name="whatsNotIncluded" rows={3} defaultValue={v.whatsNotIncluded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requirements">Requirements (one per line)</Label>
              <Textarea id="requirements" name="requirements" rows={3} defaultValue={v.requirements} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Demo & SEO</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="demoUrl">Demo URL</Label>
            <Input id="demoUrl" name="demoUrl" placeholder="https://demo.example.com" defaultValue={v.demoUrl} />
          </div>
          <div />
          <div className="space-y-1.5">
            <Label htmlFor="demoUsername">Demo username</Label>
            <Input id="demoUsername" name="demoUsername" defaultValue={v.demoUsername} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demoPassword">Demo password</Label>
            <Input id="demoPassword" name="demoPassword" defaultValue={v.demoPassword} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seoTitle">SEO title</Label>
            <Input id="seoTitle" name="seoTitle" defaultValue={v.seoTitle} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seoDescription">SEO description</Label>
            <Input id="seoDescription" name="seoDescription" defaultValue={v.seoDescription} />
          </div>
        </div>
      </section>

      <Button type="submit" size="lg">
        {submitLabel}
      </Button>
    </form>
  );
}
