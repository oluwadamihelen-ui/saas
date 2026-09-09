import Link from "next/link";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listLiveClassesForTeacher } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";
import { StartClassButton } from "./live-class-buttons";

const STATUS_VARIANT = { SCHEDULED: "accent", LIVE: "success", COMPLETED: "neutral", CANCELLED: "warning" } as const;

export default async function LiveClassesPage() {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_VIEW);
  const [liveClasses, perms] = await Promise.all([listLiveClassesForTeacher(user.schoolId, user.id), getUserPermissions(user.id)]);
  const canStart = perms.has(PERMISSIONS.LIVE_CLASSES_START);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Classes</h1>
          <p className="text-sm text-muted">Schedule and run live video classes directly inside Winfield.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/online-learning/live-classes/new">Schedule Live Class</Link>
        </Button>
      </div>

      {liveClasses.length === 0 ? (
        <EmptyState icon={<Video className="h-6 w-6" />} title="No live classes scheduled" description="Schedule your first live class to teach your students in real time." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Subject / Class</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveClasses.map((lc) => (
              <TableRow key={lc.id}>
                <TableCell className="font-medium text-foreground">{lc.title}</TableCell>
                <TableCell className="text-muted">
                  {lc.subject.name} · {lc.classArm.classGroup.name} {lc.classArm.name}
                </TableCell>
                <TableCell className="text-muted">
                  {formatDate(lc.scheduledStart)} · {lc.durationMinutes} min
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lc.status]}>{lc.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Link href={`/dashboard/online-learning/live-classes/${lc.id}`} className="text-sm font-medium text-accent hover:underline">
                      Manage
                    </Link>
                    {canStart && lc.status === "SCHEDULED" && <StartClassButton liveClassId={lc.id} />}
                    {lc.status === "LIVE" && (
                      <Link href={`/classroom/${lc.id}`} className="text-sm font-medium text-success hover:underline">
                        Enter classroom
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
