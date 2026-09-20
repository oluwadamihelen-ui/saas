"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CopyTextButton } from "@/components/dashboard/copy-text-button";
import { useActionToast } from "@/hooks/use-action-toast";
import { generateStudentPasswordsAction, type GeneratePasswordsState } from "./actions";

interface StudentRow {
  id: string;
  name: string;
  admissionNumber: string;
  className: string;
  hasAccount: boolean;
  hasGuardian: boolean;
}

const initial: GeneratePasswordsState = { status: "idle" };

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  sent: { label: "Sent", variant: "success" },
  already_has_account: { label: "Already has an account", variant: "neutral" },
  no_guardian_contact: { label: "No guardian contact", variant: "warning" },
  send_failed: { label: "Send failed", variant: "danger" },
};

export function GeneratePasswordsForm({
  classArms,
  selectedClassArmId,
  students,
}: {
  classArms: { id: string; label: string }[];
  selectedClassArmId: string;
  students: StudentRow[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(generateStudentPasswordsAction, initial);
  useActionToast(state);

  const eligible = useMemo(() => students.filter((s) => !s.hasAccount), [students]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [medium, setMedium] = useState<"email" | "sms">("email");

  const allSelected = eligible.length > 0 && eligible.every((s) => selected.has(s.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(eligible.map((s) => s.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (state.status === "done" && state.results) {
    const sent = state.results.filter((r) => r.status === "sent").length;
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          {sent} of {state.results.length} student{state.results.length === 1 ? "" : "s"} got a new password by{" "}
          {state.medium === "sms" ? "SMS" : "email"}.
        </p>
        <div className="max-h-96 overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Admission No.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Password</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.results.map((r) => {
                const meta = STATUS_LABEL[r.status];
                return (
                  <TableRow key={r.studentId}>
                    <TableCell className="font-medium text-foreground">{r.studentName}</TableCell>
                    <TableCell className="text-muted">{r.admissionNumber}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}
                    </TableCell>
                    <TableCell>{r.password ? <CopyTextButton text={r.password} label="Copy password" /> : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>Generate more</Button>
          <Button asChild variant="secondary"><Link href="/dashboard/students">Back to students</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="medium" value={medium} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Filter by class</label>
          <Select
            id="classArmId"
            defaultValue={selectedClassArmId}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set("classArmId", e.target.value);
              else url.searchParams.delete("classArmId");
              router.push(url.pathname + url.search);
            }}
          >
            <option value="">All classes</option>
            {classArms.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Share the password by</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={medium === "email"} onChange={() => setMedium("email")} /> Email
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={medium === "sms"} onChange={() => setMedium("sms")} /> SMS
            </label>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Admission No.</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted">No students in this class.</TableCell>
              </TableRow>
            )}
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    disabled={s.hasAccount}
                    onChange={() => toggleOne(s.id)}
                    aria-label={`Select ${s.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                <TableCell className="text-muted">{s.admissionNumber}</TableCell>
                <TableCell className="text-muted">{s.className}</TableCell>
                <TableCell>
                  {s.hasAccount ? (
                    <Badge variant="neutral">Has account</Badge>
                  ) : s.hasGuardian ? (
                    <Badge variant="success">Ready</Badge>
                  ) : (
                    <Badge variant="warning">No guardian on file</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={isPending || selected.size === 0}>
        {isPending ? "Generating..." : `Generate ${selected.size || ""} password${selected.size === 1 ? "" : "s"}`}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
