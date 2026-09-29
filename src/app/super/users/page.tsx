import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/require";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { StatusToggle } from "./status-toggle";

export const metadata: Metadata = { title: "Platform Users" };

export default async function SuperAdminUsersPage() {
  await requireSuperAdmin();

  const users = await prisma.user.findMany({
    where: { isSuperAdmin: false },
    include: { memberships: { include: { hotel: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Platform Users</h1>

      {users.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No users yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Hotels</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-5 py-3 text-muted">{u.email}</td>
                    <td className="px-5 py-3 text-muted">
                      {u.memberships.length === 0
                        ? "—"
                        : u.memberships.map((m) => `${m.hotel.name} (${ROLE_LABELS[m.role]})`).join(", ")}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatusToggle userId={u.id} status={u.status} />
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
