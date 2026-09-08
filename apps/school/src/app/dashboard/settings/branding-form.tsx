"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SchoolLogo } from "@/components/brand/school-logo";
import { saveBrandingAction, removeLogoAction, type BrandingFormState } from "./branding-actions";

const initialState: BrandingFormState = { status: "idle" };

export function BrandingForm({ school }: { school: { name: string; logoUrl: string | null; brandColor: string | null } }) {
  const [state, formAction, isPending] = useActionState(saveBrandingAction, initialState);
  const [isRemoving, startTransition] = useTransition();
  const [color, setColor] = useState(school.brandColor ?? "#1a6fba");
  const router = useRouter();

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <div className="space-y-1.5">
        <Label>Current logo</Label>
        <div className="flex items-center gap-4">
          <SchoolLogo name={school.name} logoUrl={school.logoUrl} height={40} />
          {school.logoUrl && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isRemoving}
              onClick={() =>
                startTransition(async () => {
                  await removeLogoAction();
                  router.refresh();
                })
              }
            >
              {isRemoving ? "Removing..." : "Remove logo"}
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logo">Upload a new logo</Label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="block text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
        />
        <p className="text-xs text-muted">PNG, JPEG, WebP or SVG, up to 2MB. Shown in your sidebar and on your public apply/pay pages.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brandColor">Brand color</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick a brand color"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1a6fba"}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-border bg-surface"
          />
          <Input
            id="brandColor"
            name="brandColor"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#1a6fba"
            className="max-w-[160px]"
          />
        </div>
        <p className="text-xs text-muted">
          Recolors buttons, links and highlights across your dashboard, portals and public pages. Clear the field for the default Winfield blue.
        </p>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save branding"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
