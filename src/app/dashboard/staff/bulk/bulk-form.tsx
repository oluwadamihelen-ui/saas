"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import {
  previewStaffBulkAction,
  confirmStaffBulkAction,
  type StaffBulkPreviewState,
  type StaffBulkConfirmState,
} from "./actions";

const previewInitial: StaffBulkPreviewState = { status: "idle" };
const confirmInitial: StaffBulkConfirmState = { status: "idle" };

interface ManualRow {
  name: string;
  email: string;
  role: string;
  phone: string;
  staffid: string;
  jobtitle: string;
  department: string;
}

function emptyRow(): ManualRow {
  return { name: "", email: "", role: "", phone: "", staffid: "", jobtitle: "", department: "" };
}

export function BulkStaffForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [method, setMethod] = useState<"MANUAL" | "CSV">("MANUAL");
  const [mode, setMode] = useState<"INVITE" | "DIRECT">("INVITE");
  const [rows, setRows] = useState<ManualRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  const [previewState, previewAction, isPreviewing] = useActionState(previewStaffBulkAction, previewInitial);
  const [confirmState, confirmAction, isConfirming] = useActionState(confirmStaffBulkAction, confirmInitial);

  function updateRow(index: number, field: keyof ManualRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  // ---- Done screen ----
  if (confirmState.status === "done") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {confirmState.created} of {(confirmState.created ?? 0) + (confirmState.failed?.length ?? 0)} account
            {confirmState.created === 1 ? "" : "s"} created{confirmState.mode === "DIRECT" ? "" : " (invitation links generated)"}.
          </p>
          {confirmState.failed && confirmState.failed.length > 0 && (
            <p className="text-sm text-danger">{confirmState.failed.length} row{confirmState.failed.length === 1 ? "" : "s"} failed.</p>
          )}
        </div>

        {confirmState.results && confirmState.results.length > 0 && (
          <div className="max-h-80 overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>{confirmState.mode === "DIRECT" ? "Password setup link" : "Invitation link"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmState.results.map((r) => (
                  <TableRow key={r.email}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted">{r.email}</TableCell>
                    <TableCell><CopyLinkButton path={`/invite/${r.inviteToken}`} label="Copy link" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {confirmState.failed && confirmState.failed.length > 0 && (
          <div className="rounded-md border border-danger/30 bg-danger-soft p-3">
            <p className="mb-1 text-xs font-medium text-danger">Failed rows</p>
            <ul className="space-y-0.5 text-xs text-danger">
              {confirmState.failed.map((f) => (
                <li key={f.rowNumber}>Row {f.rowNumber} ({f.name}): {f.error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => window.location.reload()}>Register more users</Button>
          <Button asChild variant="secondary"><Link href="/dashboard/administration/users">Go to All Users</Link></Button>
          <Button asChild variant="secondary"><Link href="/dashboard/data/history">View import history</Link></Button>
        </div>
      </div>
    );
  }

  // ---- Preview screen ----
  if (previewState.status === "previewed" && previewState.rows) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Total rows: <strong>{previewState.total}</strong></span>
          <span className="text-success">Valid: <strong>{previewState.validCount}</strong></span>
          <span className="text-danger">Invalid: <strong>{previewState.invalidCount}</strong></span>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Name · Email · Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewState.rows.map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell className="text-muted">{r.rowNumber}</TableCell>
                  <TableCell className="max-w-md truncate">{r.summary}</TableCell>
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

        <form action={confirmAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="validRowsJson" value={previewState.validRowsJson ?? "[]"} />
          <input type="hidden" name="fileName" value={previewState.fileName ?? "staff.csv"} />
          <input type="hidden" name="mode" value={mode} />
          <Button type="submit" disabled={isConfirming || !previewState.validCount}>
            {isConfirming
              ? "Creating..."
              : `${mode === "DIRECT" ? "Create" : "Generate invite links for"} ${previewState.validCount} account${previewState.validCount === 1 ? "" : "s"}`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => window.location.reload()}>Start over</Button>
          {confirmState.status === "error" && <p className="text-sm text-danger">{confirmState.message}</p>}
        </form>
      </div>
    );
  }

  // ---- Entry screen ----
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Creation method</Label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="mode-select" checked={mode === "INVITE"} onChange={() => setMode("INVITE")} />
            Create invite links (they set their own password)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="mode-select" checked={mode === "DIRECT"} onChange={() => setMode("DIRECT")} />
            Create accounts immediately (you share a password setup link)
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Entry method</Label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="method-select" checked={method === "MANUAL"} onChange={() => setMethod("MANUAL")} />
            Manual entry
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="method-select" checked={method === "CSV"} onChange={() => setMethod("CSV")} />
            CSV upload
          </label>
        </div>
      </div>

      {method === "MANUAL" ? (
        <form action={previewAction} className="space-y-4">
          <input type="hidden" name="method" value="MANUAL" />
          <input type="hidden" name="rowsJson" value={JSON.stringify(rows)} />
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-muted-surface text-left">
                <tr>
                  {["Name", "Email", "Role", "Phone", "Staff ID", "Job title", "Department", ""].map((h) => (
                    <th key={h} className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="p-1.5"><Input value={row.name} onChange={(e) => updateRow(i, "name", e.target.value)} placeholder="Jane Doe" /></td>
                    <td className="p-1.5"><Input value={row.email} onChange={(e) => updateRow(i, "email", e.target.value)} placeholder="jane@school.edu" /></td>
                    <td className="p-1.5">
                      <Select value={row.role} onChange={(e) => updateRow(i, "role", e.target.value)}>
                        <option value="">Select role</option>
                        {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </Select>
                    </td>
                    <td className="p-1.5"><Input value={row.phone} onChange={(e) => updateRow(i, "phone", e.target.value)} /></td>
                    <td className="p-1.5"><Input value={row.staffid} onChange={(e) => updateRow(i, "staffid", e.target.value)} /></td>
                    <td className="p-1.5"><Input value={row.jobtitle} onChange={(e) => updateRow(i, "jobtitle", e.target.value)} /></td>
                    <td className="p-1.5"><Input value={row.department} onChange={(e) => updateRow(i, "department", e.target.value)} /></td>
                    <td className="p-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        disabled={rows.length <= 1}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
              <Plus className="mr-1.5 h-4 w-4" /> Add row
            </Button>
          </div>
          <Button type="submit" disabled={isPreviewing}>{isPreviewing ? "Validating..." : "Preview"}</Button>
          {previewState.status === "error" && <p className="text-sm text-danger">{previewState.message}</p>}
        </form>
      ) : (
        <form action={previewAction} className="space-y-4">
          <input type="hidden" name="method" value="CSV" />
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
          <Button type="submit" disabled={isPreviewing}>{isPreviewing ? "Validating..." : "Preview"}</Button>
          {previewState.status === "error" && <p className="text-sm text-danger">{previewState.message}</p>}
        </form>
      )}
    </div>
  );
}
