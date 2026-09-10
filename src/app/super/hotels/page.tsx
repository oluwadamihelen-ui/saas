import Link from "next/link";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/require";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { listHotelsForPlatform } from "@/lib/services/hotels";

export const metadata: Metadata = { title: "Hotels" };

export default async function SuperAdminHotelsPage() {
  await requireSuperAdmin();
  const hotels = await listHotelsForPlatform();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Hotels</h1>

      {hotels.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No hotels have registered yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Hotel</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Rooms</th>
                  <th className="px-5 py-3">Staff</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hotels.map((h) => (
                  <tr key={h.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">{h.name}</td>
                    <td className="px-5 py-3 text-muted">{[h.city, h.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-5 py-3 text-muted">{h._count.rooms}</td>
                    <td className="px-5 py-3 text-muted">{h._count.members}</td>
                    <td className="px-5 py-3 text-muted">{h.subscriptionPlan}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(h.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/super/hotels/${h.id}`} className="text-xs font-medium text-accent">
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
