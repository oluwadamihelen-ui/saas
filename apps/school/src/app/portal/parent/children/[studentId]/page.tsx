import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireSchoolUser } from "@/lib/auth/require";
import { getChildForGuardian } from "@/lib/services/portal";
import { getStudentAttendanceHistory } from "@/lib/services/attendance";
import { computeReportCard } from "@/lib/services/results";
import { getCurrentTerm } from "@/lib/services/academics";
import { listAssignmentsForStudent } from "@/lib/services/assignments";
import { listSlotsForClassArm } from "@/lib/services/timetable";
import { listInvoicesForStudent, invoiceBalanceMinor } from "@/lib/services/invoices";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

const ATTENDANCE_BADGE = { PRESENT: "success", LATE: "warning", EXCUSED: "neutral", ABSENT: "danger" } as const;
const INVOICE_STATUS_VARIANT = { ISSUED: "warning", PARTIALLY_PAID: "accent", PAID: "success", CANCELLED: "neutral" } as const;
const SUBMISSION_BADGE = { PENDING: "neutral", SUBMITTED: "accent", GRADED: "success" } as const;

export default async function ChildDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const user = await requireSchoolUser();
  const student = await getChildForGuardian(user.schoolId, user.id, studentId);
  if (!student) notFound();

  const [attendance, currentTerm, assignments, school] = await Promise.all([
    getStudentAttendanceHistory(user.schoolId, student.id),
    getCurrentTerm(user.schoolId),
    listAssignmentsForStudent(user.schoolId, student.id),
    prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
  ]);
  const currentReportCard = currentTerm ? await computeReportCard(user.schoolId, student.id, currentTerm.id) : null;
  const timetable = student.classArmId ? await listSlotsForClassArm(user.schoolId, student.classArmId) : [];
  const invoices = await listInvoicesForStudent(user.schoolId, student.id);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={`${student.firstName} ${student.lastName}`} className="h-14 w-14 text-base" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{student.firstName} {student.lastName}</h1>
          <p className="text-sm text-muted">
            {student.admissionNumber} · {student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "Unassigned"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-muted">Attendance rate</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {attendance.attendanceRate === null ? "—" : `${attendance.attendanceRate}%`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Days recorded</p>
                  <p className="text-2xl font-semibold text-foreground">{attendance.total}</p>
                </div>
              </div>
              {attendance.records.length === 0 ? (
                <EmptyState title="No attendance recorded yet" />
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {attendance.records.map((r) => (
                    <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                      <span className="text-foreground">{formatDate(r.date)}</span>
                      <Badge variant={ATTENDANCE_BADGE[r.status]}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardContent className="space-y-4">
              {!currentReportCard || currentReportCard.subjectRows.length === 0 ? (
                <EmptyState title="No scores entered yet this term" />
              ) : (
                <>
                  <p className="text-sm text-muted">{currentReportCard.term?.name}</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {currentReportCard.subjectRows.map((row) => (
                      <li key={row.subjectId} className="flex items-center justify-between p-3 text-sm">
                        <span className="text-foreground">{row.subjectName}</span>
                        <span className="text-muted">{row.total}/{row.maxTotal} · {row.grade ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                  {currentReportCard.reportCard.status === "PUBLISHED" && (
                    <Link
                      href={`/api/report-cards/${student.id}/pdf?termId=${currentReportCard.term?.id}`}
                      className="text-sm text-accent hover:underline"
                    >
                      Download report card PDF
                    </Link>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          {assignments.length === 0 ? (
            <EmptyState title="No assignments yet" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {assignments.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{s.assignment.title}</p>
                    <p className="text-xs text-muted">{s.assignment.subject.name} · Due {formatDate(s.assignment.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.score !== null && <span className="text-muted">{s.score}</span>}
                    <Badge variant={SUBMISSION_BADGE[s.status]}>{s.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="timetable">
          {timetable.length === 0 ? (
            <EmptyState title="No timetable published yet" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {timetable.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-foreground">{slot.subject.name}</span>
                  <span className="text-muted">{slot.dayOfWeek} · {slot.startTime}–{slot.endTime}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="fees">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted">{inv.term.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted">{formatMoney(invoiceBalanceMinor(inv), school.currency)} due</span>
                    <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status.replace("_", " ")}</Badge>
                    <Link href={`/portal/parent/children/${studentId}/invoices/${inv.id}`} className="text-accent hover:underline">
                      Pay / view
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
