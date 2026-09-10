import Link from "next/link";
import type { Metadata } from "next";
import { Contact, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { searchGuests } from "@/lib/services/guests";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission(PERMISSIONS.GUESTS_VIEW);
  const { q } = await searchParams;
  const guests = await searchGuests(user.hotelId, q, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Guests</h1>
        <Button asChild>
          <Link href="/app/guests/new">
            <Plus className="h-4 w-4" /> New Guest
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent>
          <form action="/app/guests" className="flex gap-3">
            <Input name="q" defaultValue={q} placeholder="Search by name, phone, or email" className="max-w-sm" />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {guests.length === 0 ? (
        <EmptyState icon={<Contact className="h-6 w-6" />} title="No guests found" description={q ? "Try a different search term." : "Guests will appear here once created or booked."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Nationality</th>
                  <th className="px-5 py-3">Added</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {guests.map((g) => (
                  <tr key={g.id} className="hover:bg-muted-surface/50">
                    <td className="px-5 py-3 font-medium text-foreground">
                      {g.firstName} {g.lastName}
                    </td>
                    <td className="px-5 py-3 text-muted">{g.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{g.email ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{g.nationality ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{formatDate(g.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/app/guests/${g.id}`} className="text-xs font-medium text-accent">
                        View profile
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
