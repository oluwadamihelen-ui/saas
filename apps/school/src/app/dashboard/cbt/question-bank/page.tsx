import Link from "next/link";
import { ListChecks, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listQuestions } from "@/lib/services/cbt-questions";
import { listSubjects, listClassGroups } from "@/lib/services/academics";
import { hasFeature, getCbtQuestionBankCount, getCbtQuestionBankLimit } from "@/lib/billing/entitlements";
import { FeatureLocked } from "@/components/billing/feature-locked";
import { QuestionRowActions } from "./question-row-actions";
import type { CBTQuestionType, CBTDifficulty, CBTQuestionStatus } from "@/generated/prisma/client";

const TYPE_LABELS: Record<CBTQuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  MULTIPLE_SELECT: "Multiple select",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short answer",
  FILL_IN_BLANK: "Fill in the blank",
  ESSAY: "Essay",
  MATCHING: "Matching",
  ORDERING: "Ordering",
};

const DIFFICULTY_VARIANT: Record<CBTDifficulty, "success" | "warning" | "danger"> = {
  EASY: "success",
  MEDIUM: "warning",
  HARD: "danger",
};

const STATUS_VARIANT: Record<CBTQuestionStatus, "success" | "warning" | "neutral" | "accent"> = {
  DRAFT: "neutral",
  AI_PENDING_REVIEW: "warning",
  APPROVED: "success",
  ARCHIVED: "neutral",
};

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    subjectId?: string;
    classGroupId?: string;
    type?: string;
    difficulty?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const user = await requirePermission(PERMISSIONS.CBT_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  const params = await searchParams;

  if (!(await hasFeature(user.schoolId, "cbt"))) {
    return (
      <FeatureLocked
        description="Online examinations (CBT) aren't included in your current plan."
        canViewBilling={perms.has(PERMISSIONS.BILLING_VIEW)}
      />
    );
  }

  const [{ questions, total, page, pageCount }, subjects, classGroups, canImport, canGenerateAi, bankCount, bankLimit] = await Promise.all([
    listQuestions(user.schoolId, {
      search: params.q,
      subjectId: params.subjectId,
      classGroupId: params.classGroupId,
      type: (params.type as CBTQuestionType) || undefined,
      difficulty: (params.difficulty as CBTDifficulty) || undefined,
      status: (params.status as CBTQuestionStatus) || undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    listSubjects(user.schoolId),
    listClassGroups(user.schoolId),
    hasFeature(user.schoolId, "cbt_question_bank"),
    perms.has(PERMISSIONS.CBT_GENERATE_AI_QUESTIONS) ? hasFeature(user.schoolId, "cbt_ai_generation") : Promise.resolve(false),
    getCbtQuestionBankCount(user.schoolId),
    getCbtQuestionBankLimit(user.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Question bank</h1>
          <p className="text-sm text-muted">
            {total} question{total === 1 ? "" : "s"}
            {bankLimit !== null && ` · ${bankCount} of ${bankLimit} used`}
          </p>
        </div>
        {(canManage || canGenerateAi) && (
          <div className="flex gap-2">
            {canGenerateAi && (
              <Button asChild variant="secondary">
                <Link href="/dashboard/cbt/question-bank/generate"><Sparkles className="h-4 w-4" /> Generate with AI</Link>
              </Button>
            )}
            {canManage && (
              <>
                {canImport && (
                  <Button asChild variant="secondary">
                    <Link href="/dashboard/cbt/question-bank/import">Import CSV</Link>
                  </Button>
                )}
                <Button asChild>
                  <Link href="/dashboard/cbt/question-bank/new">Add question</Link>
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="q">Search</label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Prompt or topic" />
            </div>
            <div className="w-48 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="subjectId">Subject</label>
              <Select id="subjectId" name="subjectId" defaultValue={params.subjectId ?? ""}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="w-44 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classGroupId">Class</label>
              <Select id="classGroupId" name="classGroupId" defaultValue={params.classGroupId ?? ""}>
                <option value="">All classes</option>
                {classGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="w-44 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="type">Type</label>
              <Select id="type" name="type" defaultValue={params.type ?? ""}>
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </Select>
            </div>
            <div className="w-36 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="difficulty">Difficulty</label>
              <Select id="difficulty" name="difficulty" defaultValue={params.difficulty ?? ""}>
                <option value="">Any</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </Select>
            </div>
            <div className="w-36 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Approved</option>
                <option value="AI_PENDING_REVIEW">Pending review</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          {questions.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-6 w-6" />}
              title="No questions found"
              description={canManage ? "Try a different filter, or add a new question to the bank." : "Try a different filter."}
              action={
                canManage ? (
                  <Button asChild size="sm">
                    <Link href="/dashboard/cbt/question-bank/new">Add question</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-xs">
                      <Link
                        href={canManage ? `/dashboard/cbt/question-bank/${q.id}/edit` : "#"}
                        className="line-clamp-2 font-medium text-foreground hover:text-accent"
                      >
                        {q.prompt}
                      </Link>
                      {q.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {q.tags.map((t) => (
                            <Badge key={t.tagId} variant="neutral">{t.tag.name}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted">{q.subject.name}</TableCell>
                    <TableCell className="text-muted">{TYPE_LABELS[q.type]}</TableCell>
                    <TableCell><Badge variant={DIFFICULTY_VARIANT[q.difficulty]}>{q.difficulty}</Badge></TableCell>
                    <TableCell className="text-muted">{q.marks}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[q.status]}>{q.status.replace(/_/g, " ")}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <QuestionRowActions id={q.id} status={q.status} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Pagination page={page} pageCount={pageCount} basePath="/dashboard/cbt/question-bank" query={params} />
        </CardContent>
      </Card>
    </div>
  );
}
