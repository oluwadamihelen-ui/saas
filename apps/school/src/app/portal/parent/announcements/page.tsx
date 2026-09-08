import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getGuardianForUser } from "@/lib/services/portal";
import { listAnnouncementsForGuardian } from "@/lib/services/announcements";
import { formatDate } from "@/lib/utils";

export default async function ParentAnnouncementsPage() {
  const user = await requireSchoolUser();
  const guardian = await getGuardianForUser(user.schoolId, user.id);
  const announcements = guardian ? await listAnnouncementsForGuardian(user.schoolId, guardian.id) : [];

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
    </div>
  );
}
