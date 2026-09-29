import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserCog } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { StaffForm } from "./staff-form";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const user = await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const members = await prisma.hotelMember.findMany({
    where: { hotelId: user.hotelId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add staff member</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffForm />
        </CardContent>
      </Card>

      {members.length === 0 ? (
        <EmptyState icon={<UserCog className="h-6 w-6" />} title="No staff yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{m.user.name}</td>
                    <td className="px-5 py-3 text-muted">{m.user.email}</td>
                    <td className="px-5 py-3 text-muted">{ROLE_LABELS[m.role]}</td>
                    <td className="px-5 py-3 text-muted">{m.department ?? "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={m.employmentStatus} />
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(m.dateJoined)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/app/staff/${m.id}`} className="text-xs font-medium text-accent">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
