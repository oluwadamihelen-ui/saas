import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { getLiveClassForTeacher, getStudentLiveClassAccess } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";
import { VirtualClassroom } from "@/components/classroom/virtual-classroom";
import { StartClassInlineButton } from "./start-button";

function WaitingShell({ title, subtitle, backHref }: { title: string; subtitle: string; backHref: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-white/70">{subtitle}</p>
      <Link href={backHref} className="mt-2 text-sm font-medium text-accent hover:underline">
        ← Back
      </Link>
    </div>
  );
}

export default async function ClassroomPage({ params }: { params: Promise<{ liveClassId: string }> }) {
  const { liveClassId } = await params;
  const user = await requireSchoolUser();

  if (user.role === "STUDENT") {
    const student = await getStudentForUser(user.schoolId, user.id);
    if (!student) notFound();
    const access = await getStudentLiveClassAccess(user.schoolId, student.id, liveClassId);

    if (!access.ok) {
      if (access.reason === "not_found") notFound();
      const lc = access.liveClass;
      if (access.reason === "cancelled") {
        return <WaitingShell title="This class has been cancelled." subtitle={`${lc.subject.name}: "${lc.title}" is no longer taking place.`} backHref="/portal/student/online-learning/live-classes" />;
      }
      if (access.reason === "ended") {
        return <WaitingShell title="This class has ended." subtitle={`${lc.subject.name}: "${lc.title}" has already finished.`} backHref="/portal/student/online-learning/live-classes" />;
      }
      if (access.reason === "not_open_yet") {
        return (
          <WaitingShell
            title="Your class has not started yet."
            subtitle={`${lc.subject.name}: "${lc.title}" opens for joining at ${formatDate(access.opensAt)}, and begins at ${formatDate(lc.scheduledStart)}.`}
            backHref="/portal/student/online-learning/live-classes"
          />
        );
      }
      return (
        <WaitingShell
          title="Your class has not started yet."
          subtitle={`${lc.subject.name}: "${lc.title}" is scheduled for ${formatDate(lc.scheduledStart)}. You can join as soon as your teacher starts the class.`}
          backHref="/portal/student/online-learning/live-classes"
        />
      );
    }

    return <VirtualClassroom liveClassId={liveClassId} role="student" classTitle={access.liveClass.title} subjectName={access.liveClass.subject.name} />;
  }

  const liveClass = await getLiveClassForTeacher(user.schoolId, user.id, liveClassId);
  if (!liveClass) notFound();

  if (liveClass.status === "CANCELLED") {
    return <WaitingShell title="This class was cancelled." subtitle={`"${liveClass.title}" is no longer taking place.`} backHref="/dashboard/online-learning/live-classes" />;
  }
  if (liveClass.status === "COMPLETED") {
    return <WaitingShell title="This class has ended." subtitle={`"${liveClass.title}" already finished.`} backHref={`/dashboard/online-learning/live-classes/${liveClassId}/attendance`} />;
  }
  if (liveClass.status === "SCHEDULED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">{liveClass.title}</h1>
        <p className="max-w-md text-sm text-white/70">
          {liveClass.subject.name} · {liveClass.classArm.classGroup.name} {liveClass.classArm.name} · Scheduled for {formatDate(liveClass.scheduledStart)}
        </p>
        <StartClassInlineButton liveClassId={liveClassId} />
        <Link href="/dashboard/online-learning/live-classes" className="text-sm font-medium text-accent hover:underline">
          ← Back to live classes
        </Link>
      </div>
    );
  }

  return <VirtualClassroom liveClassId={liveClassId} role="teacher" classTitle={liveClass.title} subjectName={liveClass.subject.name} />;
}
