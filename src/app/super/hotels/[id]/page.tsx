import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/require";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getHotelForPlatform } from "@/lib/services/hotels";
import { HotelControls } from "../hotel-controls";

export const metadata: Metadata = { title: "Hotel Detail" };

export default async function SuperAdminHotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const hotel = await getHotelForPlatform(id);
  if (!hotel) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{hotel.name}</h1>
          <p className="text-sm text-muted">{[hotel.city, hotel.state, hotel.country].filter(Boolean).join(", ") || "No address on file"}</p>
        </div>
        <StatusBadge status={hotel.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Currency" value={hotel.currency} />
            <Row label="Timezone" value={hotel.timezone} />
            <Row label="Phone" value={hotel.phone} />
            <Row label="Email" value={hotel.email} />
            <Row label="Rooms" value={String(hotel._count.rooms)} />
            <Row label="Guests" value={String(hotel._count.guests)} />
            <Row label="Reservations" value={String(hotel._count.reservations)} />
            <Row label="Joined" value={formatDate(hotel.createdAt)} />
            {hotel.trialEndsAt && <Row label="Trial ends" value={formatDate(hotel.trialEndsAt)} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subscription controls</CardTitle>
          </CardHeader>
          <CardContent>
            <HotelControls hotelId={hotel.id} status={hotel.status} plan={hotel.subscriptionPlan} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {hotel.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{m.user.name}</p>
                  <p className="text-xs text-muted">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{ROLE_LABELS[m.role]}</span>
                  <StatusBadge status={m.employmentStatus} />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right text-foreground">{value || "—"}</span>
    </div>
  );
}
