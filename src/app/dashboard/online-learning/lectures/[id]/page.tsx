import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Video, Music, Image as ImageIcon, Presentation, Link as LinkIcon, File } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getLectureForTeacher, getLectureProgressForTeacher } from "@/lib/services/lectures";
import { formatDate } from "@/lib/utils";
import { PublishButton, ArchiveButton, UnpublishButton } from "./lecture-buttons";

const STATUS_VARIANT = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" } as const;

const RESOURCE_ICON = {
  VIDEO: Video,
  AUDIO: Music,
  WRITTEN: FileText,
  PDF: FileText,
  WORD_DOCUMENT: File,
  PRESENTATION: Presentation,
  IMAGE: ImageIcon,
  EXTERNAL_LINK: LinkIcon,
} as const;

export default async function LectureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.LECTURES_VIEW);
  const lecture = await getLectureForTeacher(user.schoolId, user.id, id);
  if (!lecture) notFound();

  const { summary } = await getLectureProgressForTeacher(user.schoolId, user.id, id);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lecture.title}</h1>
            <Badge variant={STATUS_VARIANT[lecture.status]}>{lecture.status}</Badge>
          </div>
          <p className="text-sm text-muted">
            {lecture.subject.name} · {lecture.classArm.classGroup.name} {lecture.classArm.name} · {lecture.term.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/dashboard/online-learning/lectures/${lecture.id}/edit`}>Edit</Link>
          </Button>
          {lecture.status === "DRAFT" && <PublishButton lectureId={lecture.id} />}
          {lecture.status === "PUBLISHED" && (
            <>
              <UnpublishButton lectureId={lecture.id} />
              <ArchiveButton lectureId={lecture.id} />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {lecture.topic && (
            <p>
              <span className="font-medium text-foreground">Topic:</span> <span className="text-muted">{lecture.topic}</span>
            </p>
          )}
          {lecture.description && (
            <p>
              <span className="font-medium text-foreground">Description:</span> <span className="text-muted">{lecture.description}</span>
            </p>
          )}
          {lecture.learningObjectives && (
            <p>
              <span className="font-medium text-foreground">Learning objectives:</span> <span className="text-muted">{lecture.learningObjectives}</span>
            </p>
          )}
          {lecture.instructions && (
            <p>
              <span className="font-medium text-foreground">Instructions:</span> <span className="text-muted">{lecture.instructions}</span>
            </p>
          )}
          {lecture.dueDate && (
            <p>
              <span className="font-medium text-foreground">Due date:</span> <span className="text-muted">{formatDate(lecture.dueDate)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content &amp; attachments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lecture.resources.length === 0 ? (
            <p className="p-4 text-sm text-muted">No content has been added to this lecture yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lecture.resources.map((resource) => {
                const Icon = RESOURCE_ICON[resource.type];
                return (
                  <li key={resource.id} className="flex items-center gap-3 p-4 text-sm">
                    <Icon className="h-5 w-5 shrink-0 text-muted" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{resource.title}</p>
                      <p className="text-xs text-muted">{resource.type.replace("_", " ")}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Students" value={summary.total} />
            <Stat label="Not started" value={summary.notStarted} />
            <Stat label="In progress" value={summary.inProgress} />
            <Stat label="Completed" value={summary.completed} />
          </div>
          <p className="text-sm text-muted">Completion rate: <span className="font-medium text-foreground">{summary.completionRate}%</span></p>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/dashboard/online-learning/lectures/${lecture.id}/progress`}>View full progress report</Link>
          </Button>
        </CardContent>
      </Card>

      <Link href="/dashboard/online-learning/lectures" className="text-sm text-accent">
        ← Back to my lectures
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
