"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { FEATURE_CATALOG, FEATURE_CATEGORIES } from "@/lib/billing/features";
import { createPlanAction, updatePlanAction, setPlanActiveAction, togglePlanFeatureAction, type PlatformFormState } from "../actions";

const initialState: PlatformFormState = { status: "idle" };

export interface PlanBrief {
  id: string;
  name: string;
  tagline: string | null;
  priceMonthlyMinor: number | null;
  priceAnnualMinor: number | null;
  currency: string;
  studentLimit: number | null;
  cbtActiveExamLimit: number | null;
  cbtQuestionBankLimit: number | null;
  cbtAiQuestionsPerMonthLimit: number | null;
  cbtCandidateLimit: number | null;
  isCustomPricing: boolean;
  isMostPopular: boolean;
  isActive: boolean;
  features: unknown;
}

function PlanFields({ plan }: { plan?: PlanBrief }) {
  const [isCustom, setIsCustom] = useState(plan?.isCustomPricing ?? false);

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${plan?.id ?? "new"}`}>Plan name</Label>
          <Input id={`name-${plan?.id ?? "new"}`} name="name" required defaultValue={plan?.name} placeholder="Growth" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tagline-${plan?.id ?? "new"}`}>Tagline</Label>
          <Input id={`tagline-${plan?.id ?? "new"}`} name="tagline" defaultValue={plan?.tagline ?? ""} placeholder="For growing schools." />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="isCustomPricing"
          checked={isCustom}
          onChange={(e) => setIsCustom(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Custom pricing (Enterprise-style — no fixed price shown)
      </label>

      {!isCustom && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`priceMonthly-${plan?.id ?? "new"}`}>Monthly price</Label>
            <Input
              id={`priceMonthly-${plan?.id ?? "new"}`}
              name="priceMonthly"
              type="number"
              min={0}
              step="0.01"
              defaultValue={plan?.priceMonthlyMinor != null ? plan.priceMonthlyMinor / 100 : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`priceAnnual-${plan?.id ?? "new"}`}>Annual price</Label>
            <Input
              id={`priceAnnual-${plan?.id ?? "new"}`}
              name="priceAnnual"
              type="number"
              min={0}
              step="0.01"
              defaultValue={plan?.priceAnnualMinor != null ? plan.priceAnnualMinor / 100 : ""}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`studentLimit-${plan?.id ?? "new"}`}>Student limit (optional)</Label>
          <Input
            id={`studentLimit-${plan?.id ?? "new"}`}
            name="studentLimit"
            type="number"
            min={1}
            placeholder="Unlimited"
            defaultValue={plan?.studentLimit ?? ""}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-foreground">
          <input type="checkbox" name="isMostPopular" defaultChecked={plan?.isMostPopular ?? false} className="h-4 w-4 rounded border-border" />
          Mark as &quot;Most popular&quot;
        </label>
      </div>

      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">CBT limits (optional — blank means unlimited)</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor={`cbtActiveExamLimit-${plan?.id ?? "new"}`}>Active exams</Label>
            <Input
              id={`cbtActiveExamLimit-${plan?.id ?? "new"}`}
              name="cbtActiveExamLimit"
              type="number"
              min={0}
              placeholder="Unlimited"
              defaultValue={plan?.cbtActiveExamLimit ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cbtQuestionBankLimit-${plan?.id ?? "new"}`}>Question bank size</Label>
            <Input
              id={`cbtQuestionBankLimit-${plan?.id ?? "new"}`}
              name="cbtQuestionBankLimit"
              type="number"
              min={0}
              placeholder="Unlimited"
              defaultValue={plan?.cbtQuestionBankLimit ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cbtAiQuestionsPerMonthLimit-${plan?.id ?? "new"}`}>AI questions/month</Label>
            <Input
              id={`cbtAiQuestionsPerMonthLimit-${plan?.id ?? "new"}`}
              name="cbtAiQuestionsPerMonthLimit"
              type="number"
              min={0}
              placeholder="Unlimited"
              defaultValue={plan?.cbtAiQuestionsPerMonthLimit ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cbtCandidateLimit-${plan?.id ?? "new"}`}>CBT candidates/term</Label>
            <Input
              id={`cbtCandidateLimit-${plan?.id ?? "new"}`}
              name="cbtCandidateLimit"
              type="number"
              min={0}
              placeholder="Unlimited"
              defaultValue={plan?.cbtCandidateLimit ?? ""}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function CreatePlanForm() {
  const [state, formAction, isPending] = useActionState(createPlanAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <PlanFields />
      <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create plan"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function PlanRow({ plan }: { plan: PlanBrief }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isManagingFeatures, setIsManagingFeatures] = useState(false);

  if (isEditing) {
    return <EditPlanForm plan={plan} onDone={() => setIsEditing(false)} />;
  }

  return (
    <li className="space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium text-foreground">
            {plan.name}
            {plan.isMostPopular && <Badge variant="accent">Most popular</Badge>}
            {!plan.isActive && <Badge variant="neutral">Inactive</Badge>}
          </p>
          <p className="text-xs text-muted">
            {plan.isCustomPricing
              ? "Custom pricing"
              : `${plan.priceMonthlyMinor != null ? formatMoney(plan.priceMonthlyMinor, plan.currency) : "—"}/mo · ${plan.priceAnnualMinor != null ? formatMoney(plan.priceAnnualMinor, plan.currency) : "—"}/yr`}
            {" · "}
            {plan.studentLimit ? `up to ${plan.studentLimit} students` : "unlimited students"}
            {" · "}
            {plan.cbtActiveExamLimit ? `${plan.cbtActiveExamLimit} active CBT exams` : "unlimited active CBT exams"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsManagingFeatures((v) => !v)}>
            {isManagingFeatures ? "Hide features" : "Manage features"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>Edit</Button>
          <PlanActiveToggle planId={plan.id} isActive={plan.isActive} />
        </div>
      </div>
      {isManagingFeatures && <FeatureMatrixEditor planId={plan.id} features={(plan.features as Record<string, boolean>) ?? {}} />}
    </li>
  );
}

function EditPlanForm({ plan, onDone }: { plan: PlanBrief; onDone: () => void }) {
  const action = updatePlanAction.bind(null, plan.id);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone (setIsEditing(false)) is a fresh closure each render; only re-run when the save actually succeeds.
  }, [state.status]);

  return (
    <li className="p-4 text-sm">
      <form action={formAction} className="space-y-4">
        <PlanFields plan={plan} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Save changes"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </form>
    </li>
  );
}

export function PlanActiveToggle({ planId, isActive }: { planId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant={isActive ? "ghost" : "secondary"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setPlanActiveAction(planId, !isActive);
          router.refresh();
        })
      }
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}

function FeatureMatrixEditor({ planId, features }: { planId: string; features: Record<string, boolean> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [local, setLocal] = useState(features);

  function toggle(key: string) {
    const next = !local[key];
    setLocal((prev) => ({ ...prev, [key]: next }));
    startTransition(async () => {
      await togglePlanFeatureAction(planId, key, next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted-surface p-4">
      {FEATURE_CATEGORIES.map((category) => {
        const categoryFeatures = FEATURE_CATALOG.filter((f) => f.category === category);
        return (
          <div key={category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{category}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {categoryFeatures.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(local[f.key])}
                    disabled={isPending}
                    onChange={() => toggle(f.key)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
