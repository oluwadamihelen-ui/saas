import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getGuardianForUser } from "@/lib/services/portal";
import { NeedsAttentionCard } from "@/components/notifications/needs-attention-card";
import { ViewAsChildButton } from "@/components/portal/view-as-child-button";

export default async function ParentChildrenPage() {
  const user = await requireSchoolUser();
  const guardian = await getGuardianForUser(user.schoolId, user.id);
  const children = guardian?.students ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My children</h1>
        <p className="text-sm text-muted">Tap a child to see attendance, results, assignments and fees.</p>
      </div>

      <NeedsAttentionCard schoolId={user.schoolId} userId={user.id} viewAllHref="/portal/parent/notifications" />

      {children.length === 0 ? (
        <EmptyState title="No children linked to this account yet" description="Contact the school office if this looks wrong." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((sg) => (
            <Card key={sg.studentId}>
              <CardContent className="flex flex-wrap items-center gap-4">
                <Avatar name={`${sg.student.firstName} ${sg.student.lastName}`} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{sg.student.firstName} {sg.student.lastName}</p>
                  <p className="text-xs text-muted">
                    {sg.student.classArm ? `${sg.student.classArm.classGroup.name} ${sg.student.classArm.name}` : "Unassigned"}
                  </p>
                </div>
                <Badge variant="accent">{sg.relationship}</Badge>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Button asChild variant="secondary" size="sm" className="flex-1 sm:flex-none">
                    <Link href={`/portal/parent/children/${sg.studentId}`}>View summary</Link>
                  </Button>
                  <ViewAsChildButton studentId={sg.studentId} label="View portal" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
