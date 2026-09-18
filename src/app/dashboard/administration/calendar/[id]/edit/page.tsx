import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getCalendarEvent } from "@/lib/services/calendar";
import { listClassArms, listTerms } from "@/lib/services/academics";
import { EventForm } from "../../event-form";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.CALENDAR_MANAGE);
  const { id } = await params;

  const [event, classArms, terms] = await Promise.all([
    getCalendarEvent(user.schoolId, id),
    listClassArms(user.schoolId),
    listTerms(user.schoolId),
  ]);
  if (!event) notFound();

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/administration/calendar">&larr; Calendar</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit Event</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{event.title}</CardTitle></CardHeader>
        <CardContent><EventForm classArms={classArms} terms={terms} event={event} /></CardContent>
      </Card>
    </div>
  );
}
