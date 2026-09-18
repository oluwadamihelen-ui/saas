import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getLiveClassForTeacher } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";
import { StartClassButton, EndClassButton, CancelClassButton } from "../live-class-buttons";

const STATUS_VARIANT = { SCHEDULED: "accent", LIVE: "success", COMPLETED: "neutral", CANCELLED: "warning" } as const;

export default async function LiveClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_VIEW);
  const [liveClass, perms] = await Promise.all([getLiveClassForTeacher(user.schoolId, user.id, id), getUserPermissions(user.id)]);
  if (!liveClass) notFound();
  const canStart = perms.has(PERMISSIONS.LIVE_CLASSES_START);
  const canManage = perms.has(PERMISSIONS.LIVE_CLASSES_MANAGE);

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{liveClass.title}</h1>
            <Badge variant={STATUS_VARIANT[liveClass.status]}>{liveClass.status}</Badge>
          </div>
          <p className="text-sm text-muted">
            {liveClass.subject.name} · {liveClass.classArm.classGroup.name} {liveClass.classArm.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {liveClass.status === "SCHEDULED" && canManage && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/dashboard/online-learning/live-classes/${liveClass.id}/edit`}>Edit</Link>
            </Button>
          )}
          {liveClass.status === "SCHEDULED" && canStart && <StartClassButton liveClassId={liveClass.id} />}
          {liveClass.status === "SCHEDULED" && canManage && <CancelClassButton liveClassId={liveClass.id} />}
          {liveClass.status === "LIVE" && (
            <>
              <Button asChild size="sm">
                <Link href={`/classroom/${liveClass.id}`}>Enter classroom</Link>
              </Button>
              {canStart && <EndClassButton liveClassId={liveClass.id} />}
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {liveClass.topic && (
            <p>
              <span className="font-medium text-foreground">Topic:</span> <span className="text-muted">{liveClass.topic}</span>
            </p>
          )}
          {liveClass.description && (
            <p>
              <span className="font-medium text-foreground">Description:</span> <span className="text-muted">{liveClass.description}</span>
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Scheduled:</span> <span className="text-muted">{formatDate(liveClass.scheduledStart)}</span>
          </p>
          <p>
            <span className="font-medium text-foreground">Duration:</span> <span className="text-muted">{liveClass.durationMinutes} minutes</span>
          </p>
          {liveClass.maxParticipants && (
            <p>
              <span className="font-medium text-foreground">Max participants:</span> <span className="text-muted">{liveClass.maxParticipants}</span>
            </p>
          )}
          {liveClass.startedAt && (
            <p>
              <span className="font-medium text-foreground">Started:</span> <span className="text-muted">{formatDate(liveClass.startedAt)}</span>
            </p>
          )}
          {liveClass.endedAt && (
            <p>
              <span className="font-medium text-foreground">Ended:</span> <span className="text-muted">{formatDate(liveClass.endedAt)}</span>
            </p>
          )}
          {liveClass.cancelReason && (
            <p>
              <span className="font-medium text-foreground">Cancelled:</span> <span className="text-muted">{liveClass.cancelReason}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {(liveClass.status === "COMPLETED" || liveClass.status === "LIVE") && (
        <Link href={`/dashboard/online-learning/live-classes/${liveClass.id}/attendance`} className="text-sm font-medium text-accent hover:underline">
          View attendance
        </Link>
      )}

      <div>
        <Link href="/dashboard/online-learning/live-classes" className="text-sm text-accent">
          ← Back to live classes
        </Link>
      </div>
    </div>
  );
}
