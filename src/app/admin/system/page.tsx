import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/tenant";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default async function AdminSystemPage() {
  await requireAdmin();

  const [webhookEvents, auditLogs] = await Promise.all([
    prisma.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System</h1>
        <p className="mt-1 text-sm text-muted-foreground">Webhooks, errors, and audit logs.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent webhook events</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhookEvents.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.source}</TableCell>
                  <TableCell>{e.eventType}</TableCell>
                  <TableCell>
                    <Badge variant={e.processedAt ? "success" : "outline"}>{e.processedAt ? "Processed" : "Pending"}</Badge>
                  </TableCell>
                  <TableCell className="text-red-600">{e.error ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.action}</TableCell>
                  <TableCell>{a.entityType ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
