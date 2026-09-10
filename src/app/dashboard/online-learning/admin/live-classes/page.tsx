import { Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllLiveClassesForSchool } from "@/lib/services/live-classes";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { SCHEDULED: "accent", LIVE: "success", COMPLETED: "neutral", CANCELLED: "warning" } as const;

export default async function AdminLiveClassesPage() {
  const user = await requirePermission(PERMISSIONS.ONLINE_LEARNING_VIEW_ALL);
  const liveClasses = await listAllLiveClassesForSchool(user.schoolId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Classes</h1>
        <p className="text-sm text-muted">Scheduled, live and completed classes across the school.</p>
      </div>

      {liveClasses.length === 0 ? (
        <EmptyState icon={<Video className="h-6 w-6" />} title="No live classes have been scheduled yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Subject / Class</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveClasses.map((lc) => (
              <TableRow key={lc.id}>
                <TableCell className="font-medium text-foreground">{lc.title}</TableCell>
                <TableCell className="text-muted">{lc.teacher.name}</TableCell>
                <TableCell className="text-muted">
                  {lc.subject.name} · {lc.classArm.classGroup.name} {lc.classArm.name}
                </TableCell>
                <TableCell className="text-muted">{formatDate(lc.scheduledStart)}</TableCell>
                <TableCell className="text-muted">{lc.durationMinutes} min</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lc.status]}>{lc.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
