import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getLectureForStudent } from "@/lib/services/lectures";
import { LectureViewer } from "./lecture-viewer";

export default async function StudentLecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) notFound();

  const result = await getLectureForStudent(user.schoolId, student.id, id);
  if (!result) notFound();
  const { lecture, progress, previous, next } = result;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{lecture.subject.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lecture.title}</h1>
        <p className="text-sm text-muted">Teacher: {lecture.teacher.name}</p>
      </div>

      {(lecture.topic || lecture.description || lecture.learningObjectives) && (
        <div className="space-y-2 rounded-md border border-border p-4 text-sm">
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
        </div>
      )}

      <LectureViewer
        lectureId={lecture.id}
        resources={lecture.resources}
        initialStatus={progress?.status ?? "NOT_STARTED"}
        initialPositionSeconds={progress?.lastVideoPositionSeconds ?? 0}
      />

      <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
        {previous ? (
          <Link href={`/portal/student/online-learning/lectures/${previous.id}`} className="font-medium text-accent hover:underline">
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/portal/student/online-learning/lectures/${next.id}`} className="font-medium text-accent hover:underline">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
