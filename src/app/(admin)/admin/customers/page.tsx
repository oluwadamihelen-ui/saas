import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { promoteToDeveloper, revertToCustomer, suspendUser, reactivateUser } from "./actions";

export const metadata: Metadata = { title: "Users" };

const ROLE_VARIANT: Record<string, "neutral" | "accent"> = {
  CUSTOMER: "neutral",
  DEVELOPER: "accent",
};

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: "Buyer",
  DEVELOPER: "Developer",
};

const TABS: { key: "all" | "CUSTOMER" | "DEVELOPER"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "CUSTOMER", label: "Buyers" },
  { key: "DEVELOPER", label: "Developers" },
];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
  const { role } = await searchParams;
  const activeRole = role === "CUSTOMER" || role === "DEVELOPER" ? role : "all";

  const users = await prisma.user.findMany({
    where: activeRole === "all" ? { role: { key: { in: ["CUSTOMER", "DEVELOPER"] } } } : { role: { key: activeRole } },
    orderBy: { createdAt: "desc" },
    include: { role: true, _count: { select: { orders: true, deployments: true, createdApplications: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Buyers and developers on the platform. Staff and admin accounts are managed separately under Staff.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/admin/customers" : `/admin/customers?role=${tab.key}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeRole === tab.key ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Apps</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${user.id}`} className="font-medium text-accent">
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANT[user.role.key] ?? "neutral"}>{ROLE_LABEL[user.role.key] ?? user.role.key}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{user._count.orders}</td>
                  <td className="px-4 py-3 text-muted">{user._count.createdApplications}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {user.role.key === "CUSTOMER" ? (
                        <form action={promoteToDeveloper.bind(null, user.id)}>
                          <Button type="submit" size="sm" variant="outline">
                            Make Developer
                          </Button>
                        </form>
                      ) : (
                        <form action={revertToCustomer.bind(null, user.id)}>
                          <Button type="submit" size="sm" variant="outline">
                            Revert to Buyer
                          </Button>
                        </form>
                      )}
                      {user.status === "ACTIVE" ? (
                        <form action={suspendUser.bind(null, user.id)}>
                          <Button type="submit" size="sm" variant="destructive">
                            Suspend
                          </Button>
                        </form>
                      ) : (
                        <form action={reactivateUser.bind(null, user.id)}>
                          <Button type="submit" size="sm" variant="secondary">
                            Reactivate
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
