import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listSubjects } from "@/lib/services/academics";
import { prisma } from "@/lib/db";
import { getSchemeOfWork, listClassGroupsWithMode } from "@/lib/services/scheme-of-work";
import { StartSchemeButton } from "./start-scheme-button";
import { TopicForm } from "./topic-form";
import { MilestoneForm } from "./milestone-form";
import { ArchiveMilestoneButton } from "./archive-milestone-button";

export default async function SchemeOfWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ classGroupId?: string; subjectId?: string; termId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  const params = await searchParams;

  const [classGroups, subjects, terms] = await Promise.all([
    listClassGroupsWithMode(user.schoolId),
    listSubjects(user.schoolId),
    prisma.term.findMany({ where: { schoolId: user.schoolId }, orderBy: { startDate: "desc" }, include: { academicSession: true } }),
  ]);
  const milestoneClassGroups = classGroups.filter((c) => c.assessmentMode !== "NUMERICAL");

  const classGroupId = params.classGroupId || milestoneClassGroups[0]?.id;
  const subjectId = params.subjectId || subjects[0]?.id;
  const termId = params.termId || terms.find((t) => t.isCurrent)?.id || terms[0]?.id;
  const term = terms.find((t) => t.id === termId);

  const scheme = classGroupId && subjectId && termId ? await getSchemeOfWork(user.schoolId, termId, classGroupId, subjectId) : null;

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scheme of Work</h1>
          <p className="text-sm text-muted">Define the weeks/topics and milestones that Pre-School Results are assessed against.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/results/preschool">Back to Pre-School Results</Link>
        </Button>
      </div>

      {milestoneClassGroups.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No milestone-assessed classes yet"
              description="Set a class's assessment mode to Milestone (or Both) in Pre-School settings first."
              action={<Button asChild size="sm"><Link href="/dashboard/results/preschool/settings">Open settings</Link></Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4">
              <form className="flex flex-wrap items-end gap-3" method="get">
                <div className="w-56 space-y-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="termId">Term</label>
                  <Select id="termId" name="termId" defaultValue={termId ?? ""}>
                    {terms.map((t) => <option key={t.id} value={t.id}>{t.academicSession.name} · {t.name}</option>)}
                  </Select>
                </div>
                <div className="w-56 space-y-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="classGroupId">Class</label>
                  <Select id="classGroupId" name="classGroupId" defaultValue={classGroupId ?? ""}>
                    {milestoneClassGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div className="w-56 space-y-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="subjectId">Subject</label>
                  <Select id="subjectId" name="subjectId" defaultValue={subjectId ?? ""}>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">Load</Button>
              </form>
            </CardContent>
          </Card>

          {!classGroupId || !subjectId || !termId || !term ? (
            <EmptyState title="Select a term, class and subject above" />
          ) : !scheme ? (
            <Card>
              <CardContent>
                <EmptyState
                  title="No Scheme of Work yet for this class and subject"
                  description={`Create one for ${term.name} to start adding weeks/topics and milestones.`}
                  action={<StartSchemeButton academicSessionId={term.academicSessionId} termId={termId} classGroupId={classGroupId} subjectId={subjectId} />}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add a week/topic</CardTitle>
                  <CardDescription>e.g. Week 1 — Pronouns</CardDescription>
                </CardHeader>
                <CardContent>
                  <TopicForm schemeOfWorkId={scheme.id} />
                </CardContent>
              </Card>

              {scheme.topics.length === 0 ? (
                <EmptyState title="No weeks/topics added yet" />
              ) : (
                scheme.topics.map((topic) => (
                  <Card key={topic.id}>
                    <CardHeader>
                      <CardTitle>Week {topic.weekNumber} — {topic.title}</CardTitle>
                      {topic.description && <CardDescription>{topic.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {topic.milestones.length === 0 ? (
                        <EmptyState title="No milestones yet" className="p-4" />
                      ) : (
                        <ul className="divide-y divide-border rounded-md border border-border">
                          {topic.milestones.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                              <div>
                                <p className="font-medium text-foreground">{m.title}</p>
                                {m.description && <p className="text-xs text-muted">{m.description}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={m.status === "ACTIVE" ? "success" : m.status === "DRAFT" ? "neutral" : "warning"}>{m.status}</Badge>
                                <ArchiveMilestoneButton milestoneId={m.id} status={m.status} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <MilestoneForm topicId={topic.id} />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
