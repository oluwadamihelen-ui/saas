import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { listAnnouncementsForStudent } from "@/lib/services/announcements";
import { formatDate } from "@/lib/utils";

export default async function StudentAnnouncementsPage() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const announcements = await listAnnouncementsForStudent(user.schoolId, student.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Announcements</h1>
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
