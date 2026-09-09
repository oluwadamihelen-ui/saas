import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudent } from "@/lib/services/students";
import { getStudentAttendanceHistory } from "@/lib/services/attendance";
import { computeReportCard } from "@/lib/services/results";
import { getCurrentTerm } from "@/lib/services/academics";
import { listInvoicesForStudent, invoiceBalanceMinor } from "@/lib/services/invoices";
import { listPortalInvitesForGuardian, listPortalInvitesForStudent } from "@/lib/services/portal-invites";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { WithdrawButton } from "./withdraw-button";
import { AddGuardianForm } from "./add-guardian-form";
import { PortalInviteForm } from "./portal-invite-form";
import { inviteGuardianPortalAction, inviteStudentPortalAction } from "../actions";

const ATTENDANCE_BADGE = { PRESENT: "success", LATE: "warning", EXCUSED: "neutral", ABSENT: "danger" } as const;

const STATUS_VARIANT = { ACTIVE: "success", GRADUATED: "neutral", WITHDRAWN: "warning", SUSPENDED: "danger" } as const;

const INVOICE_STATUS_VARIANT = { ISSUED: "warning", PARTIALLY_PAID: "accent", PAID: "success", CANCELLED: "neutral" } as const;

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSchoolUser();
  const [student, perms] = await Promise.all([getStudent(user.schoolId, id), getUserPermissions(user.id)]);

  if (!student) notFound();

  const attendance = perms.has(PERMISSIONS.ATTENDANCE_VIEW)
    ? await getStudentAttendanceHistory(user.schoolId, student.id)
    : null;

  const currentTerm = perms.has(PERMISSIONS.RESULTS_VIEW) ? await getCurrentTerm(user.schoolId) : null;
  const currentReportCard = currentTerm ? await computeReportCard(user.schoolId, student.id, currentTerm.id) : null;

  const canViewFinance = perms.has(PERMISSIONS.FINANCE_VIEW);
  const [invoices, school] = canViewFinance
    ? await Promise.all([listInvoicesForStudent(user.schoolId, student.id), prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } })])
    : [null, null];

  const canEdit = perms.has(PERMISSIONS.STUDENTS_EDIT);
  const canDelete = perms.has(PERMISSIONS.STUDENTS_DELETE);
  const canManageGuardians = perms.has(PERMISSIONS.GUARDIANS_MANAGE);
  const canManagePortalAccess = canEdit || canManageGuardians;
  const canViewTranscript = perms.has(PERMISSIONS.TRANSCRIPTS_VIEW);

  const studentInvites = canEdit ? await listPortalInvitesForStudent(user.schoolId, student.id) : [];
  const guardianInvites = canManageGuardians
    ? await Promise.all(
        student.guardians.map(async (sg) => ({
          guardianId: sg.guardianId,
          invites: await listPortalInvitesForGuardian(user.schoolId, sg.guardianId),
        }))
      )
    : [];
  const guardianInviteMap = new Map(guardianInvites.map((g) => [g.guardianId, g.invites]));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {student.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image can't optimize it
            <img
              src={student.photoUrl}
              alt={`${student.firstName} ${student.lastName}`}
              className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <Avatar name={`${student.firstName} ${student.lastName}`} className="h-14 w-14 text-base" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {student.firstName} {student.lastName}
            </h1>
            <p className="text-sm text-muted">
              {student.admissionNumber} ·{" "}
              {student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "Unassigned"}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[student.status]}>{student.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/dashboard/students/${student.id}/edit`}>Edit</Link>
            </Button>
          )}
          {canDelete && student.status === "ACTIVE" && <WithdrawButton studentId={student.id} />}
        </div>
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          {attendance && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
          {currentReportCard && <TabsTrigger value="results">Results</TabsTrigger>}
          {canViewTranscript && <TabsTrigger value="transcript">Academic Transcript</TabsTrigger>}
          {invoices && <TabsTrigger value="finance">Finance</TabsTrigger>}
          <TabsTrigger value="health">Health</TabsTrigger>
          {canManagePortalAccess && <TabsTrigger value="portal">Portal access</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Full name" value={`${student.firstName} ${student.otherNames ?? ""} ${student.lastName}`.replace(/\s+/g, " ")} />
              <Field label="Date of birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : "—"} />
              <Field label="Gender" value={student.gender ?? "—"} />
              <Field label="Nationality" value={student.nationality ?? "—"} />
              <Field label="Address" value={[student.addressLine, student.city, student.state].filter(Boolean).join(", ") || "—"} />
              <Field label="Admission date" value={formatDate(student.admissionDate)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Class" value={student.classArm ? `${student.classArm.classGroup.name} ${student.classArm.name}` : "Unassigned"} />
              <Field label="Campus" value={student.campus?.name ?? "Main"} />
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted">See the Attendance and Results tabs for this student&apos;s records.</p>
        </TabsContent>

        <TabsContent value="guardians">
          <div className="space-y-4">
            {student.guardians.length === 0 ? (
              <EmptyState title="No guardians on file" description="Add a parent or guardian below." />
            ) : (
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {student.guardians.map((sg) => (
                    <div key={sg.guardianId} className="flex items-center justify-between p-4 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{sg.guardian.firstName} {sg.guardian.lastName}</p>
                        <p className="text-xs text-muted">{sg.guardian.phone}{sg.guardian.email ? ` · ${sg.guardian.email}` : ""}</p>
                      </div>
                      <Badge variant="accent">{sg.relationship}{sg.isPrimary ? " · Primary" : ""}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {canManageGuardians && <AddGuardianForm studentId={student.id} />}
          </div>
        </TabsContent>

        {attendance && (
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
        )}

        {currentReportCard && (
          <TabsContent value="results">
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">{currentReportCard.term?.name}</p>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/dashboard/results/report-cards/${student.id}?termId=${currentReportCard.term?.id}`}>
                      View full report card
                    </Link>
                  </Button>
                </div>
                {currentReportCard.subjectRows.length === 0 ? (
                  <EmptyState title="No scores entered yet this term" />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {currentReportCard.subjectRows.map((row) => (
                      <li key={row.subjectId} className="flex items-center justify-between p-3 text-sm">
                        <span className="text-foreground">{row.subjectName}</span>
                        <span className="text-muted">{row.total}/{row.maxTotal} · {row.grade ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewTranscript && (
          <TabsContent value="transcript">
            <Card>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted">
                  View this student&apos;s complete academic history across every session they&apos;ve attended, generate an
                  official transcript, and download or print it as a PDF.
                </p>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/dashboard/students/${student.id}/transcript`}>View Academic Transcript</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {invoices && school && (
          <TabsContent value="finance">
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between p-3 text-sm">
                    <Link href={`/dashboard/finance/invoices/${inv.id}`} className="font-medium text-foreground hover:text-accent">
                      {inv.invoiceNumber}
                    </Link>
                    <div className="flex items-center gap-3 text-muted">
                      <span>{inv.term.name}</span>
                      <span>{formatMoney(invoiceBalanceMinor(inv), school.currency)} due</span>
                      <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status.replace("_", " ")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )}

        <TabsContent value="health">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Blood group" value={student.bloodGroup ?? "—"} />
              <Field label="Emergency contact" value={student.emergencyContact ?? "—"} />
              <Field label="Allergies" value={student.allergies ?? "—"} full />
              <Field label="Medical notes" value={student.medicalNotes ?? "—"} full />
            </CardContent>
          </Card>
        </TabsContent>

        {canManagePortalAccess && (
          <TabsContent value="portal">
            <div className="space-y-4">
              {canEdit && (
                <Card>
                  <CardContent className="space-y-3">
                    <p className="text-sm font-medium text-foreground">{student.firstName}&apos;s student portal login</p>
                    {student.userId ? (
                      <Badge variant="success">Portal account active</Badge>
                    ) : (
                      <>
                        <PortalInviteForm action={inviteStudentPortalAction.bind(null, student.id)} />
                        {studentInvites.filter((i) => i.status === "PENDING").map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                            <span className="text-muted">{invite.email}</span>
                            <code className="text-xs text-muted">/portal-invite/{invite.token}</code>
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              {canManageGuardians &&
                student.guardians.map((sg) => (
                  <Card key={sg.guardianId}>
                    <CardContent className="space-y-3">
                      <p className="text-sm font-medium text-foreground">
                        {sg.guardian.firstName} {sg.guardian.lastName}&apos;s parent portal login
                      </p>
                      {sg.guardian.userId ? (
                        <Badge variant="success">Portal account active</Badge>
                      ) : (
                        <>
                          <PortalInviteForm
                            action={inviteGuardianPortalAction.bind(null, student.id, sg.guardianId)}
                            defaultEmail={sg.guardian.email}
                          />
                          {(guardianInviteMap.get(sg.guardianId) ?? [])
                            .filter((i) => i.status === "PENDING")
                            .map((invite) => (
                              <div key={invite.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                                <span className="text-muted">{invite.email}</span>
                                <code className="text-xs text-muted">/portal-invite/{invite.token}</code>
                              </div>
                            ))}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
