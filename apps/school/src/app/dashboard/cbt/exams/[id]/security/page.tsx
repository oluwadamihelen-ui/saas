import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getExam } from "@/lib/services/cbt-exams";
import { listSecurityEventsForExam } from "@/lib/services/cbt-security";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { CBTSecurityEventType } from "@/generated/prisma/client";

const EVENT_LABEL: Record<CBTSecurityEventType, string> = {
  TAB_SWITCH: "Tab switch",
  WINDOW_BLUR: "Window lost focus",
  FULLSCREEN_EXIT: "Exited fullscreen",
  COPY_ATTEMPT: "Copy attempted",
  PASTE_ATTEMPT: "Paste attempted",
  RIGHT_CLICK_ATTEMPT: "Right-click attempted",
  CONNECTION_LOST: "Connection lost",
  CONNECTION_RESTORED: "Connection restored",
  SUSPICIOUS_NAVIGATION: "Suspicious navigation",
};

const EVENT_VARIANT: Record<CBTSecurityEventType, "neutral" | "accent" | "warning" | "danger"> = {
  TAB_SWITCH: "warning",
  WINDOW_BLUR: "warning",
  FULLSCREEN_EXIT: "danger",
  COPY_ATTEMPT: "danger",
  PASTE_ATTEMPT: "danger",
  RIGHT_CLICK_ATTEMPT: "neutral",
  CONNECTION_LOST: "accent",
  CONNECTION_RESTORED: "accent",
  SUSPICIOUS_NAVIGATION: "danger",
};

export default async function ExamSecurityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_VIEW_RESULTS);
  const { id } = await params;

  const exam = await getExam(user.schoolId, id);
  if (!exam) notFound();

  const events = await listSecurityEventsForExam(user.schoolId, id);

  const byStudent = new Map<string, { name: string; admissionNumber: string; count: number }>();
  for (const e of events) {
    const key = e.attempt.student.admissionNumber;
    const existing = byStudent.get(key);
    if (existing) existing.count += 1;
    else
      byStudent.set(key, {
        name: `${e.attempt.student.firstName} ${e.attempt.student.lastName}`,
        admissionNumber: e.attempt.student.admissionNumber,
        count: 1,
      });
  }
  const summary = [...byStudent.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Security log — {exam.title}</h1>
        <p className="text-sm text-muted">
          A record of what happened during each attempt — not an accusation. Use your judgement to decide what, if anything, it means.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" />}
          title="No security events recorded"
          description="Nothing suspicious has been logged for this exam's attempts so far."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>By student</CardTitle>
              <CardDescription>Total events recorded per candidate, most first.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s) => (
                    <TableRow key={s.admissionNumber}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-muted">{s.admissionNumber}</TableCell>
                      <TableCell className="text-muted">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {e.attempt.student.firstName} {e.attempt.student.lastName}
                        <span className="ml-1.5 text-xs text-muted">({e.attempt.student.admissionNumber})</span>
                      </TableCell>
                      <TableCell className="text-muted">#{e.attempt.attemptNumber}</TableCell>
                      <TableCell><Badge variant={EVENT_VARIANT[e.type]}>{EVENT_LABEL[e.type]}</Badge></TableCell>
                      <TableCell className="text-muted">{formatDateTime(e.occurredAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
