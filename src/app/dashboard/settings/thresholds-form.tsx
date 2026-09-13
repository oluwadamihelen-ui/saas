"use client";

import { useActionState, useMemo, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveThresholdsAction, type ThresholdsState } from "./thresholds-actions";

import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ThresholdsState = { status: "idle" };

export function ThresholdsForm({
  currency,
  expenseApprovalThresholdMinor,
  performancePassMark,
  performanceSignificantChangePoints,
  attendanceConcernThreshold,
  performanceFailedSubjectConcernThreshold,
  healthScoreWeightAcademic,
  healthScoreWeightAttendance,
  healthScoreWeightFinancial,
  healthScoreWeightOperational,
}: {
  currency: string;
  expenseApprovalThresholdMinor: number;
  performancePassMark: number;
  performanceSignificantChangePoints: number;
  attendanceConcernThreshold: number;
  performanceFailedSubjectConcernThreshold: number;
  healthScoreWeightAcademic: number;
  healthScoreWeightAttendance: number;
  healthScoreWeightFinancial: number;
  healthScoreWeightOperational: number;
}) {
  const [state, formAction, isPending] = useActionState(saveThresholdsAction, initialState);
  useActionToast(state);

  const [weights, setWeights] = useState({
    academic: healthScoreWeightAcademic,
    attendance: healthScoreWeightAttendance,
    financial: healthScoreWeightFinancial,
    operational: healthScoreWeightOperational,
  });
  const weightSum = useMemo(
    () => weights.academic + weights.attendance + weights.financial + weights.operational,
    [weights]
  );

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Finance</h3>
        <div className="space-y-1.5">
          <Label htmlFor="expenseApprovalThreshold">Expense approval threshold ({currency})</Label>
          <Input
            id="expenseApprovalThreshold"
            name="expenseApprovalThreshold"
            type="number"
            min={0}
            step="0.01"
            defaultValue={expenseApprovalThresholdMinor / 100}
          />
          <p className="text-xs text-muted">Expenses at or above this amount require owner/admin approval before being marked approved.</p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Student Performance Analysis</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="performancePassMark">Pass mark (%)</Label>
            <Input id="performancePassMark" name="performancePassMark" type="number" min={0} max={100} defaultValue={performancePassMark} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="performanceSignificantChangePoints">Significant change (points)</Label>
            <Input
              id="performanceSignificantChangePoints"
              name="performanceSignificantChangePoints"
              type="number"
              min={1}
              max={100}
              defaultValue={performanceSignificantChangePoints}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendanceConcernThreshold">Attendance concern threshold (%)</Label>
            <Input
              id="attendanceConcernThreshold"
              name="attendanceConcernThreshold"
              type="number"
              min={0}
              max={100}
              defaultValue={attendanceConcernThreshold}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="performanceFailedSubjectConcernThreshold">Failed-subjects concern threshold</Label>
            <Input
              id="performanceFailedSubjectConcernThreshold"
              name="performanceFailedSubjectConcernThreshold"
              type="number"
              min={1}
              max={50}
              defaultValue={performanceFailedSubjectConcernThreshold}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Used by the risk engine behind Student Performance Analysis to flag a student as needing attention.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">School Health Score weights</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="healthScoreWeightAcademic">Academic</Label>
            <Input
              id="healthScoreWeightAcademic"
              name="healthScoreWeightAcademic"
              type="number"
              min={0}
              max={100}
              value={weights.academic}
              onChange={(e) => setWeights((w) => ({ ...w, academic: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="healthScoreWeightAttendance">Attendance</Label>
            <Input
              id="healthScoreWeightAttendance"
              name="healthScoreWeightAttendance"
              type="number"
              min={0}
              max={100}
              value={weights.attendance}
              onChange={(e) => setWeights((w) => ({ ...w, attendance: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="healthScoreWeightFinancial">Financial</Label>
            <Input
              id="healthScoreWeightFinancial"
              name="healthScoreWeightFinancial"
              type="number"
              min={0}
              max={100}
              value={weights.financial}
              onChange={(e) => setWeights((w) => ({ ...w, financial: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="healthScoreWeightOperational">Operational</Label>
            <Input
              id="healthScoreWeightOperational"
              name="healthScoreWeightOperational"
              type="number"
              min={0}
              max={100}
              value={weights.operational}
              onChange={(e) => setWeights((w) => ({ ...w, operational: Number(e.target.value) }))}
            />
          </div>
        </div>
        <p className={`mt-2 text-xs ${weightSum === 100 ? "text-muted" : "text-danger"}`}>
          These must add up to 100. Current total: {weightSum}.
        </p>
      </div>

      <Button type="submit" disabled={isPending || weightSum !== 100}>
        {isPending ? "Saving..." : "Save changes"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
