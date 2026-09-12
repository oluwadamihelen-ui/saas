"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { saveScoreGridAction, type ScoreGridState } from "./actions";

const initialState: ScoreGridState = { status: "idle" };

export function ScoreGridForm({
  classArmId,
  subjectId,
  termId,
  components,
  rows,
}: {
  classArmId: string;
  subjectId: string;
  termId: string;
  components: { id: string; name: string; maxScore: number }[];
  rows: { student: { id: string; firstName: string; lastName: string }; values: (number | null)[] }[];
}) {
  const action = saveScoreGridAction.bind(null, classArmId, subjectId, termId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            {components.map((c) => (
              <TableHead key={c.id}>{c.name} <span className="text-muted">/{c.maxScore}</span></TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ student, values }) => (
            <TableRow key={student.id}>
              <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
              {components.map((c, i) => (
                <TableCell key={c.id}>
                  <Input
                    type="number"
                    min={0}
                    max={c.maxScore}
                    name={`score__${student.id}__${c.id}`}
                    defaultValue={values[i] ?? ""}
                    className="w-20"
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save scores"}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
      </div>
    </form>
  );
}
