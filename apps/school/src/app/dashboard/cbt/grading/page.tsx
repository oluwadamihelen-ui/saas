import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listGradingQueue } from "@/lib/services/cbt-grading";

export default async function GradingQueuePage({ searchParams }: { searchParams: Promise<{ examId?: string }> }) {
  const user = await requirePermission(PERMISSIONS.CBT_GRADE);
  const params = await searchParams;

  const queue = await listGradingQueue(user.schoolId, { examId: params.examId });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manual grading</h1>
        <p className="text-sm text-muted">{queue.length} answer{queue.length === 1 ? "" : "s"} waiting for a grade.</p>
      </div>

      <Card>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title="All caught up" description="No answers are waiting for manual grading." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.attempt.student.firstName} {a.attempt.student.lastName}</TableCell>
                    <TableCell className="text-muted">{a.attempt.exam.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{a.question.prompt}</TableCell>
                    <TableCell><Badge variant="neutral">{a.question.marks}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/cbt/grading/${a.id}`} className="text-sm font-medium text-accent hover:underline">
                        Grade
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
