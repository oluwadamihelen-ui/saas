"use client";

import { useActionState } from "react";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { saveMilestoneGridAction, type MilestoneGridState } from "./actions";

const initialState: MilestoneGridState = { status: "idle" };

export interface MilestoneColumn {
  id: string;
  title: string;
  topicTitle: string;
  weekNumber: number;
}

export interface MilestoneGridRow {
  student: { id: string; firstName: string; lastName: string };
  values: { milestoneId: string; level: string | null; comment: string | null; assessedAt: Date | string | null }[];
}

export function MilestoneGridForm({
  classArmId,
  subjectId,
  termId,
  assessmentPeriodId,
  milestones,
  rows,
  levels,
}: {
  classArmId: string;
  subjectId: string;
  termId: string;
  assessmentPeriodId: string;
  milestones: MilestoneColumn[];
  rows: MilestoneGridRow[];
  levels: { level: string; label: string }[];
}) {
  const action = saveMilestoneGridAction.bind(null, classArmId, subjectId, termId, assessmentPeriodId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              {milestones.map((m) => (
                <TableHead key={m.id} className="min-w-[220px]">
                  <span className="block text-xs text-muted">Week {m.weekNumber} · {m.topicTitle}</span>
                  {m.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ student, values }) => (
              <TableRow key={student.id}>
                <TableCell className="align-top font-medium">{student.firstName} {student.lastName}</TableCell>
                {milestones.map((m, i) => {
                  const v = values[i];
                  return (
                    <TableCell key={m.id} className="align-top">
                      <div className="space-y-1.5">
                        <Select name={`level__${student.id}__${m.id}`} defaultValue={v.level ?? ""} className="w-48">
                          <option value="">— Not assessed —</option>
                          {levels.map((opt) => (
                            <option key={opt.level} value={opt.level}>{opt.label}</option>
                          ))}
                        </Select>
                        <Input
                          name={`comment__${student.id}__${m.id}`}
                          defaultValue={v.comment ?? ""}
                          placeholder="Optional comment"
                          className="w-48 text-xs"
                        />
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save assessments"}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
      </div>
    </form>
  );
}
