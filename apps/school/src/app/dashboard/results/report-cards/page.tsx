import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listClassArms } from "@/lib/services/academics";
import { prisma } from "@/lib/db";
import { listReportCardsForClass } from "@/lib/services/results";

const STATUS_VARIANT = { DRAFT: "neutral", APPROVED: "warning", PUBLISHED: "success" } as const;

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ classArmId?: string; termId?: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const params = await searchParams;

  const [classArms, terms] = await Promise.all([
    listClassArms(user.schoolId),
    prisma.term.findMany({ where: { schoolId: user.schoolId }, orderBy: { startDate: "desc" } }),
  ]);

  const classArmId = params.classArmId || classArms[0]?.id;
  const termId = params.termId || terms.find((t) => t.isCurrent)?.id || terms[0]?.id;

  const list = classArmId && termId ? await listReportCardsForClass(user.schoolId, classArmId, termId) : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Report cards</h1>
        <p className="text-sm text-muted">Review, approve and publish each student&apos;s report card.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 sm:space-y-6">
          <form className="flex items-end gap-3" method="get">
            <div className="w-64 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="classArmId">Class</label>
              <Select id="classArmId" name="classArmId" defaultValue={classArmId ?? ""}>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>{arm.classGroup.name} {arm.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-56 space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="termId">Term</label>
              <Select id="termId" name="termId" defaultValue={termId ?? ""}>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <Button type="submit" variant="secondary">Load</Button>
          </form>

          {list.length === 0 ? (
            <EmptyState title="No students in this class" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {list.map(({ student, reportCard }) => (
                <li key={student.id} className="flex items-center justify-between p-3 text-sm">
                  <Link href={`/dashboard/results/report-cards/${student.id}?termId=${termId}`} className="font-medium text-foreground hover:text-accent">
                    {student.firstName} {student.lastName}
                  </Link>
                  <Badge variant={STATUS_VARIANT[reportCard?.status ?? "DRAFT"]}>{reportCard?.status ?? "DRAFT"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
