import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireSchoolUser } from "@/lib/auth/require";
import { getGuardianForUser } from "@/lib/services/portal";
import { listAnnouncementsForGuardian } from "@/lib/services/announcements";
import { formatDate } from "@/lib/utils";

export default async function ParentAnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireSchoolUser();
  const params = await searchParams;
  const guardian = await getGuardianForUser(user.schoolId, user.id);
  const { announcements, page, pageCount } = guardian
    ? await listAnnouncementsForGuardian(user.schoolId, guardian.id, params.page ? Number(params.page) : 1)
    : { announcements: [], page: 1, pageCount: 1 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Announcements</h1>
        <p className="text-sm text-muted">Notices from the school and your children&apos;s classes.</p>
      </div>

      {announcements.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <Badge variant="accent">{a.publishedAt ? formatDate(a.publishedAt) : ""}</Badge>
                </div>
                <p className="whitespace-pre-line text-sm text-foreground">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}

      <Pagination page={page} pageCount={pageCount} basePath="/portal/parent/announcements" />
    </div>
  );
}
