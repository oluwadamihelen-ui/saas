"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { previewImportAction, confirmImportAction, type ImportPreviewState, type ImportConfirmState } from "../actions";

export function ImportForm() {
  const router = useRouter();
  const [previewState, previewAction, isPreviewing] = useActionState(
    previewImportAction,
    { status: "idle" } as ImportPreviewState
  );
  const [confirmState, confirmAction, isConfirming] = useActionState(
    confirmImportAction,
    { status: "idle" } as ImportConfirmState
  );

  if (confirmState.status === "done") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          Imported <strong>{confirmState.created}</strong> question{confirmState.created === 1 ? "" : "s"} into the bank.
        </p>
        <Button onClick={() => router.push("/dashboard/cbt/question-bank")}>Back to question bank</Button>
      </div>
    );
  }

  const validCount = previewState.rows?.filter((r) => r.valid).length ?? 0;

  return (
    <div className="space-y-6">
      {previewState.status !== "previewed" && (
        <form action={previewAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="file">CSV file</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent"
            />
          </div>
          <Button type="submit" disabled={isPreviewing}>{isPreviewing ? "Reading file..." : "Preview import"}</Button>
          {previewState.status === "error" && <p className="text-sm text-danger">{previewState.message}</p>}
        </form>
      )}

      {previewState.status === "previewed" && previewState.rows && (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {validCount} of {previewState.rows.length} row{previewState.rows.length === 1 ? "" : "s"} are valid and ready to import.
          </p>

          <div className="max-h-96 overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewState.rows.map((r) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell className="text-muted">{r.rowNumber}</TableCell>
                    <TableCell className="max-w-md truncate">{r.prompt}</TableCell>
                    <TableCell>
                      {r.valid ? (
                        <Badge variant="success">Valid</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="danger">Invalid</Badge>
                          <ul className="list-disc pl-4 text-xs text-danger">
                            {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <form action={confirmAction} className="flex items-center gap-3">
            <input type="hidden" name="validRowsJson" value={previewState.validRowsJson ?? "[]"} />
            <Button type="submit" disabled={isConfirming || validCount === 0}>
              {isConfirming ? "Importing..." : `Import ${validCount} question${validCount === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.refresh()}>
              Start over
            </Button>
            {confirmState.status === "error" && <p className="text-sm text-danger">{confirmState.message}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
