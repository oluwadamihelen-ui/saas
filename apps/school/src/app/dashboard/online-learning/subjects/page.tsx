import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listTeachableAssignments } from "@/lib/services/lectures";

export default async function MySubjectsPage() {
  const user = await requirePermission(PERMISSIONS.LECTURES_VIEW);
  const assignments = await listTeachableAssignments(user.schoolId, user.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Subjects</h1>
        <p className="text-sm text-muted">Subjects and classes you are assigned to teach — lectures and live classes can only be created for these.</p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No subjects assigned yet" description="Ask an administrator to assign you to a subject and class." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => (
            <Card key={`${a.subjectId}-${a.classArmId}`}>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <p className="font-medium text-foreground">{a.subject.name}</p>
                  <p className="text-sm text-muted">{a.classArm.classGroup.name} {a.classArm.name}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Link href="/dashboard/online-learning/lectures/new" className="font-medium text-accent hover:underline">
                    Create lecture
                  </Link>
                  <Link href="/dashboard/online-learning/live-classes/new" className="font-medium text-accent hover:underline">
                    Schedule live class
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
