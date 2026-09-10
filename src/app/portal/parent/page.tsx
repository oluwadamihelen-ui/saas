import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getGuardianForUser } from "@/lib/services/portal";

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

      {children.length === 0 ? (
        <EmptyState title="No children linked to this account yet" description="Contact the school office if this looks wrong." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((sg) => (
            <Link key={sg.studentId} href={`/portal/parent/children/${sg.studentId}`}>
              <Card className="transition-colors hover:border-accent">
                <CardContent className="flex items-center gap-4">
                  <Avatar name={`${sg.student.firstName} ${sg.student.lastName}`} className="h-12 w-12" />
                  <div>
                    <p className="font-medium text-foreground">{sg.student.firstName} {sg.student.lastName}</p>
                    <p className="text-xs text-muted">
                      {sg.student.classArm ? `${sg.student.classArm.classGroup.name} ${sg.student.classArm.name}` : "Unassigned"}
                    </p>
                  </div>
                  <Badge variant="accent" className="ml-auto">{sg.relationship}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
