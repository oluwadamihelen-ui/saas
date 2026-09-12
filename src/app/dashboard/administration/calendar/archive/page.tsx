import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listArchivedCalendarEvents } from "@/lib/services/calendar";
import { formatDate } from "@/lib/utils";

export default async function CalendarArchivePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.CALENDAR_VIEW);
  const params = await searchParams;
  const { events, total, page, pageCount } = await listArchivedCalendarEvents(user.schoolId, params.page ? Number(params.page) : 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/administration/calendar">&larr; Calendar</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar Archive</h1>
        <p className="text-sm text-muted">{total} past event{total === 1 ? "" : "s"}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Past events</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          {events.length === 0 ? (
            <EmptyState title="No past events yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Term</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="p-4 pt-0">
            <Pagination page={page} pageCount={pageCount} basePath="/dashboard/administration/calendar/archive" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
