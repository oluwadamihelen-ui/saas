"use client";

import { useActionState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateAssessmentLevelLabelAction, type PreschoolSettingsState } from "./actions";

const initialState: PreschoolSettingsState = { status: "idle" };
const VARIANTS = ["neutral", "accent", "secondary", "success", "warning", "danger"] as const;
type BadgeVariant = (typeof VARIANTS)[number];

export function LevelLabelForm({ level, label, colorVariant }: { level: string; label: string; colorVariant: string }) {
  const [state, formAction, isPending] = useActionState(updateAssessmentLevelLabelAction, initialState);
  const variant = (VARIANTS.includes(colorVariant as BadgeVariant) ? colorVariant : "neutral") as BadgeVariant;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
      <input type="hidden" name="level" value={level} />
      <Badge variant={variant} className="mb-2">{label}</Badge>
      <div className="w-56 space-y-1.5">
        <Label htmlFor={`label-${level}`}>Label</Label>
        <Input id={`label-${level}`} name="label" required defaultValue={label} />
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor={`color-${level}`}>Colour</Label>
        <Select id={`color-${level}`} name="colorVariant" defaultValue={variant}>
          {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
