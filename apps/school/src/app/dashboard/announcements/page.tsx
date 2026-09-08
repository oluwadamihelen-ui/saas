import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listAnnouncements } from "@/lib/services/announcements";
import { listClassArms } from "@/lib/services/academics";
import { formatDate } from "@/lib/utils";
import { AnnouncementForm } from "./announcement-form";
import { publishAnnouncementAction } from "./actions";

const AUDIENCE_LABEL: Record<string, string> = {
  SCHOOL_WIDE: "Whole school",
  STAFF_ONLY: "Staff only",
  PARENTS_ONLY: "Parents only",
  CLASS: "Class",
};

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.ANNOUNCEMENTS_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.ANNOUNCEMENTS_MANAGE);
  const params = await searchParams;

  const [{ announcements, total, page, pageCount }, classArms] = await Promise.all([
    listAnnouncements(user.schoolId, params.page ? Number(params.page) : 1),
    canManage ? listClassArms(user.schoolId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Announcements</h1>
        <p className="text-sm text-muted">{total} notice{total === 1 ? "" : "s"} — school-wide, staff, parent and class.</p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>New announcement</CardTitle>
            <CardDescription>Publishing immediately notifies every matching recipient in-app.</CardDescription>
          </CardHeader>
          <CardContent>
            <AnnouncementForm classArms={classArms} />
          </CardContent>
        </Card>
      )}

      {announcements.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted">
                      {a.createdBy.name} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="accent">
                      {AUDIENCE_LABEL[a.audience]}
                      {a.audience === "CLASS" && a.classArm ? ` · ${a.classArm.classGroup.name} ${a.classArm.name}` : ""}
                    </Badge>
                    {a.publishedAt ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="warning">Draft</Badge>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-line text-sm text-foreground">{a.body}</p>
                {canManage && !a.publishedAt && (
                  <form action={publishAnnouncementAction.bind(null, a.id)}>
                    <Button type="submit" size="sm" variant="secondary">Publish</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </ul>
      )}

      <Pagination page={page} pageCount={pageCount} basePath="/dashboard/announcements" />
    </div>
  );
}
