"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  saveReportCardDesignAction,
  removeReportCardHeaderAction,
  removeReportCardWatermarkAction,
  removeReportCardSignatureAction,
  type ReportCardDesignFormState,
} from "./report-card-design-actions";

import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ReportCardDesignFormState = { status: "idle" };

function ImageSlot({
  label,
  hint,
  name,
  currentUrl,
  onRemove,
}: {
  label: string;
  hint: string;
  name: string;
  currentUrl: string | null;
  onRemove: () => Promise<void>;
}) {
  const [isRemoving, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {currentUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not a Next-optimizable remote asset */}
          <img src={currentUrl} alt={label} className="h-16 max-w-[220px] rounded border border-border object-contain" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isRemoving}
            onClick={() =>
              startTransition(async () => {
                await onRemove();
                router.refresh();
              })
            }
          >
            {isRemoving ? "Removing..." : "Remove"}
          </Button>
        </div>
      )}
      <input
        id={name}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="block text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
      />
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

export function ReportCardDesignForm({
  school,
}: {
  school: {
    reportCardHeaderUrl: string | null;
    reportCardWatermarkUrl: string | null;
    reportCardSignatureUrl: string | null;
    reportCardFooterText: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(saveReportCardDesignAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-6">
      <ImageSlot
        label="Header / letterhead"
        hint="A full-width banner (school crest, name, colors, border — however you design it) drawn at the top of every report card in place of the plain text header. PNG, JPEG, WebP or SVG, up to 3MB."
        name="header"
        currentUrl={school.reportCardHeaderUrl}
        onRemove={removeReportCardHeaderAction}
      />
      <ImageSlot
        label="Watermark"
        hint="An optional faint image (e.g. your school crest) shown centered behind the report card content. PNG, JPEG, WebP or SVG, up to 2MB."
        name="watermark"
        currentUrl={school.reportCardWatermarkUrl}
        onRemove={removeReportCardWatermarkAction}
      />
      <ImageSlot
        label="Authorized signature / stamp"
        hint="Shown next to the principal's comment on every report card. PNG, JPEG, WebP or SVG, up to 1MB."
        name="signature"
        currentUrl={school.reportCardSignatureUrl}
        onRemove={removeReportCardSignatureAction}
      />
      <div className="space-y-1.5">
        <Label htmlFor="footerText">Footer note</Label>
        <Textarea
          id="footerText"
          name="footerText"
          defaultValue={school.reportCardFooterText ?? ""}
          rows={2}
          placeholder="e.g. Next term begins Monday, 12th January. Discipline · Excellence · Service."
        />
        <p className="text-xs text-muted">Shown at the bottom of every report card. Leave blank to show nothing.</p>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save report card design"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
