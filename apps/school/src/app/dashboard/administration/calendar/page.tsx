import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { listCalendarEvents } from "@/lib/services/calendar";
import { listClassArms, listTerms } from "@/lib/services/academics";
import { formatDate } from "@/lib/utils";
import { EventForm } from "./event-form";
import { EventRowActions } from "./event-actions";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.CALENDAR_VIEW);
  const perms = await getUserPermissions(user.id);
  const canManage = perms.has(PERMISSIONS.CALENDAR_MANAGE);
  const params = await searchParams;

  const [{ events, total, page, pageCount }, classArms, terms] = await Promise.all([
    listCalendarEvents(user.schoolId, params.page ? Number(params.page) : 1),
    canManage ? listClassArms(user.schoolId) : Promise.resolve([]),
    canManage ? listTerms(user.schoolId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="text-sm text-muted">{total} upcoming event{total === 1 ? "" : "s"}</p>
        </div>
        <Button asChild variant="secondary"><Link href="/dashboard/administration/calendar/archive">View Archive</Link></Button>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add an event</CardTitle>
            <CardDescription>Past events move to the archive automatically once they end.</CardDescription>
          </CardHeader>
          <CardContent><EventForm classArms={classArms} terms={terms} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Upcoming events</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          {events.length === 0 ? (
            <EmptyState title="No upcoming events" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Term</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{e.title}</p>
                      {e.description && <p className="text-xs text-muted">{e.description}</p>}
                    </TableCell>
                    <TableCell className="text-muted">
                      {e.classArm ? `${e.classArm.classGroup.name} ${e.classArm.name}` : <Badge variant="neutral">Whole school</Badge>}
                    </TableCell>
                    <TableCell className="text-muted">{formatDate(e.startAt)}</TableCell>
                    <TableCell className="text-muted">{formatDate(e.endAt)}</TableCell>
                    <TableCell className="text-muted">{e.term?.name ?? "—"}</TableCell>
                    {canManage && <TableCell className="text-right"><EventRowActions id={e.id} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/administration/calendar" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
